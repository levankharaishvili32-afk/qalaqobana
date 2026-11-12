import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, type Socket } from 'socket.io';
import type { CreatePayload, JoinAck, JoinPayload, RejoinPayload } from '../shared/types';
import type { Player, Room } from './room';
import { RoomManager } from './roomManager';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AppOptions {
  /** დროების მასშტაბი — ტესტებისთვის */
  timeScale?: number;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 100_000 });
  const manager = new RoomManager(
    (socketId, event, payload) => io.to(socketId).emit(event, payload),
    options.timeScale ?? 1,
  );

  // ---------- frontend ----------
  const clientDir = path.resolve(__dirname, '../dist/client');
  app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: manager.size }));
  if (fs.existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
  } else {
    app.get('*', (_req, res) =>
      res
        .status(503)
        .type('text/plain; charset=utf-8')
        .send('საიტი ჯერ არ არის აწყობილი. გაუშვით: npm run build'),
    );
  }

  // ---------- real-time ----------
  io.on('connection', (socket: Socket) => {
    const context = (): { room: Room; player: Player } | null => {
      const room = manager.get(socket.data.code);
      const player = room?.get(socket.data.playerId);
      return room && player && player.socketId === socket.id ? { room, player } : null;
    };
    const fail = (message: string | null) => {
      if (message) socket.emit('room:error', { message });
    };
    const leaveCurrent = (remove: boolean) => {
      const ctx = context();
      socket.data.code = undefined;
      socket.data.playerId = undefined;
      if (!ctx) return;
      if (remove) ctx.room.removePlayer(ctx.player.id);
      else ctx.room.detach(socket.id);
    };
    const enter = (room: Room, player: Player, ack: (a: JoinAck) => void) => {
      socket.data.code = room.code;
      socket.data.playerId = player.id;
      ack({ ok: true, code: room.code, playerId: player.id, token: player.token });
      room.attach(player, socket.id);
    };
    /** ივენთის უსაფრთხო რეგისტრაცია: შეცდომა სერვერს არ აგდებს */
    const on = (event: string, handler: (payload: any, ack: (a: any) => void) => void) => {
      socket.on(event, (payload: unknown, ack: unknown) => {
        try {
          handler(payload && typeof payload === 'object' ? payload : {}, typeof ack === 'function' ? (ack as any) : () => {});
        } catch (err) {
          console.error(`[${event}]`, err);
          fail('რაღაც შეცდომა მოხდა, სცადეთ თავიდან');
        }
      });
    };
    /** მოქმედება, რომელიც ოთახში ყოფნას მოითხოვს */
    const inRoom = (event: string, handler: (ctx: { room: Room; player: Player }, payload: any) => string | null | void) =>
      on(event, (payload) => {
        const ctx = context();
        if (!ctx) return fail('ოთახთან კავშირი დაკარგულია');
        fail(handler(ctx, payload) ?? null);
      });
    /** მოქმედება, რომელიც მხოლოდ ჰოსტს შეუძლია */
    const hostOnly = (event: string, handler: (ctx: { room: Room; player: Player }, payload: any) => string | null | void) =>
      inRoom(event, (ctx, payload) =>
        ctx.room.isHost(ctx.player) ? handler(ctx, payload) : 'ეს მხოლოდ ჰოსტს შეუძლია',
      );

    on('room:create', (p: CreatePayload, ack: (a: JoinAck) => void) => {
      leaveCurrent(false);
      const room = manager.create(String(p.roomName ?? ''), typeof p.password === 'string' ? p.password : '');
      const player = room.addPlayer(String(p.nickname ?? ''));
      if (typeof player === 'string') {
        manager.delete(room.code);
        return ack({ ok: false, error: player });
      }
      enter(room, player, ack);
    });

    on('room:join', (p: JoinPayload, ack: (a: JoinAck) => void) => {
      const room = manager.get(p.code);
      if (!room) return ack({ ok: false, error: 'ასეთი ოთახი ვერ მოიძებნა. შეამოწმეთ კოდი' });
      if (!room.checkPassword(typeof p.password === 'string' ? p.password : ''))
        return ack({ ok: false, error: room.hasPassword && !p.password ? 'ამ ოთახს პაროლი აქვს' : 'პაროლი არასწორია' });
      leaveCurrent(false);
      const player = room.addPlayer(String(p.nickname ?? ''));
      if (typeof player === 'string') return ack({ ok: false, error: player });
      enter(room, player, ack);
    });

    on('room:rejoin', (p: RejoinPayload, ack: (a: JoinAck) => void) => {
      const room = manager.get(p.code);
      const player = room?.get(String(p.playerId ?? ''));
      if (!room || !player || player.token !== p.token)
        return ack({ ok: false, error: 'ძველი სესია ვეღარ მოიძებნა' });
      if (socket.data.playerId !== player.id) leaveCurrent(false);
      enter(room, player, ack);
    });

    on('room:info', (p: { code?: string }, ack) => {
      const room = manager.get(p.code);
      ack(room ? { ok: true, name: room.name, hasPassword: room.hasPassword } : { ok: false, error: 'ასეთი ოთახი ვერ მოიძებნა' });
    });

    on('room:leave', () => leaveCurrent(true));
    socket.on('disconnect', () => leaveCurrent(false));

    hostOnly('host:updateSettings', ({ room }, p) => room.updateSettings(p));
    hostOnly('host:kick', ({ room, player }, p) => {
      if (p.playerId === player.id) return 'საკუთარ თავს ვერ გააგდებთ';
      room.removePlayer(String(p.playerId), true);
    });
    hostOnly('host:start', ({ room }) => room.start());
    hostOnly('host:next', ({ room }) => room.next());
    hostOnly('host:continue', ({ room }) => room.continueGame());
    hostOnly('host:endGame', ({ room }) => room.endGame());
    hostOnly('host:newGame', ({ room }) => room.newGame());
    hostOnly('host:override', ({ room }, p) => room.override(String(p.playerId), String(p.categoryId), p.decision));
    hostOnly('host:merge', ({ room }, p) => room.merge(String(p.categoryId), String(p.a), String(p.b)));
    hostOnly('host:unmerge', ({ room }, p) => room.unmerge(String(p.categoryId), String(p.playerId)));

    inRoom('round:draft', ({ room, player }, p) => {
      room.saveDraft(player, p.answers);
    });
    inRoom('round:stop', ({ room, player }, p) => room.stop(player, p.answers));
    inRoom('review:vote', ({ room, player }, p) => room.vote(player, String(p.playerId), String(p.categoryId)));
    inRoom('review:ready', ({ room, player }) => room.ready(player));
  });

  return {
    app,
    server,
    io,
    manager,
    close: () =>
      new Promise<void>((resolve) => {
        manager.close();
        io.close(() => resolve());
      }),
  };
}
