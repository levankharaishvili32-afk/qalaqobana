/**
 * "ხელოვნური მეგობრები": ბოტები შემოდიან თქვენს ოთახში და თქვენთან ერთად თამაშობენ,
 * რომ თამაში მარტომ გატესტოთ.
 *
 * გაშვება (სერვერი უკვე გაშვებული უნდა იყოს):
 *   npm run friends -- ABC123        ← ოთახის კოდი, ნაგულისხმევად 3 ბოტი
 *   npm run friends -- ABC123 9      ← 9 ბოტი
 *   npm run friends -- ABC123 9 პაროლი
 */
import { io } from 'socket.io-client';
import type { JoinAck, RoomState } from '../shared/types';

const [code, countArg, password] = process.argv.slice(2);
const count = Math.min(9, Math.max(1, Number(countArg) || 3));
const url = process.env.URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const NAMES = ['ნინო', 'გიორგი', 'მარიამი', 'ლუკა', 'ანა', 'დათო', 'თამარი', 'სანდრო', 'ელენე'];
const ENDINGS = ['ანა', 'ური', 'ეთი', 'ოლა', 'ისი', 'ადო'];

if (!code) {
  console.error('მიუთითეთ ოთახის კოდი, მაგ.:  npm run friends -- ABC123');
  process.exit(1);
}

const rand = (n: number) => Math.floor(Math.random() * n);
const wait = (min: number, max: number) => new Promise((r) => setTimeout(r, min + rand(max - min)));

for (let i = 0; i < count; i++) {
  const name = NAMES[i];
  const socket = io(url, { transports: ['websocket'], forceNew: true });
  let actedOn = '';

  socket.on('connect', () => {
    socket.emit('room:join', { code, nickname: name, password }, (ack: JoinAck) => {
      console.log(ack.ok ? `✓ ${name} შემოვიდა` : `✗ ${name}: ${ack.error}`);
      if (!ack.ok) socket.disconnect();
    });
  });
  socket.on('room:kicked', () => socket.disconnect());

  socket.on('room:state', async (state: RoomState) => {
    const round = state.round;
    if (!round) return;
    const stamp = `${state.phase}:${round.number}`;
    if (actedOn === stamp) return;

    if (state.phase === 'writing' && round.letter) {
      actedOn = stamp;
      await wait(4000, 12000);
      const answers: Record<string, string> = {};
      for (const c of round.categories) {
        const roll = rand(10);
        // ზოგჯერ ცარიელი, ზოგჯერ არასწორი ასო, ზოგჯერ სხვებთან ერთნაირი
        if (roll === 0) answers[c.id] = '';
        else if (roll === 1) answers[c.id] = 'შეცდომა';
        else answers[c.id] = round.letter + ENDINGS[rand(roll < 5 ? 2 : ENDINGS.length)];
      }
      socket.emit('round:draft', { answers });
      if (i === 0 && Object.values(answers).every(Boolean)) {
        await wait(8000, 15000);
        socket.emit('round:stop', { answers });
      }
    }

    if (state.phase === 'review' && round.table) {
      actedOn = stamp;
      await wait(2000, 5000);
      // ყველა ბოტი ეჭვობს "…ადო"-ზე დამთავრებულ პასუხებს
      for (const [playerId, row] of Object.entries(round.table)) {
        for (const [categoryId, cell] of Object.entries(row)) {
          if (playerId !== state.youId && cell.check === 'ok' && cell.text.endsWith('ადო'))
            socket.emit('review:vote', { playerId, categoryId });
        }
      }
      await wait(3000, 8000);
      socket.emit('review:ready');
    }
  });
}

console.log(`${count} ბოტი უკავშირდება ოთახს ${code} (${url}). გასათიშად: Ctrl+C`);
