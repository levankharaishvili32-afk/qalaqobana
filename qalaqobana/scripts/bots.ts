/**
 * 10 ბოტ-მოთამაშე ატარებს სრულ თამაშს ნამდვილ სერვერზე (დაჩქარებული დროებით)
 * და ამოწმებს, რომ წესები სწორად მუშაობს.
 *
 * გაშვება:  npm run bots
 */
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { createApp } from '../server/app';
import { LATIN_PREFIXES } from '../shared/config/alphabet';
import type { JoinAck, RoomState } from '../shared/types';

const BOT_COUNT = 10;
const ROUNDS = 3;
const TIME_SCALE = 0.1;

let checks = 0;
function check(condition: unknown, label: string) {
  checks++;
  if (!condition) throw new Error(`ვერ გაიარა შემოწმება: ${label}`);
  console.log(`  ✓ ${label}`);
}

class Bot {
  socket!: Socket;
  state: RoomState | null = null;
  errors: string[] = [];
  kicked = false;
  id = '';
  token = '';
  constructor(
    readonly url: string,
    readonly name: string,
  ) {
    this.connect();
  }
  connect() {
    this.socket = io(this.url, { transports: ['websocket'], forceNew: true });
    this.socket.on('room:state', (s: RoomState) => (this.state = s));
    this.socket.on('room:error', (e: { message: string }) => this.errors.push(e.message));
    this.socket.on('room:kicked', () => (this.kicked = true));
  }
  ask<T>(event: string, payload: object): Promise<T> {
    return new Promise((resolve) => this.socket.emit(event, payload, resolve));
  }
  send(event: string, payload: object = {}) {
    this.socket.emit(event, payload);
  }
  async join(code: string, password?: string) {
    const ack = await this.ask<JoinAck>('room:join', { code, nickname: this.name, password });
    if (ack.ok) {
      this.id = ack.playerId;
      this.token = ack.token;
    }
    return ack;
  }
  async rejoin(code: string) {
    this.connect();
    return this.ask<JoinAck>('room:rejoin', { code, playerId: this.id, token: this.token });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(condition: () => boolean, label: string, timeoutMs = 15_000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error(`დრო ამოიწურა: ${label}`);
    await sleep(15);
  }
}

async function main() {
  const { server, close } = createApp({ timeScale: TIME_SCALE });
  await new Promise<void>((r) => server.listen(0, r));
  const url = `http://localhost:${(server.address() as AddressInfo).port}`;
  const bots: Bot[] = [];
  const extras: Bot[] = [];

  try {
    console.log('\n① ოთახი და ლობი');
    const host = new Bot(url, 'ბოტი-0');
    bots.push(host);
    const created = await host.ask<JoinAck>('room:create', {
      roomName: 'ბოტების ოთახი',
      nickname: host.name,
      password: 'saidumlo',
    });
    if (!created.ok) throw new Error(created.error);
    host.id = created.playerId;
    host.token = created.token;
    const code = created.code;
    check(/^[A-Z2-9]{6}$/.test(code), `ოთახი შეიქმნა, კოდი ${code}`);

    const stranger = new Bot(url, 'უცხო');
    extras.push(stranger);
    const badPass = await stranger.join(code, 'araswori');
    check(!badPass.ok, 'არასწორი პაროლით შესვლა არ ხდება');
    const noRoom = await stranger.join('ZZZZZZ');
    check(!noRoom.ok, 'არარსებული კოდით შესვლა არ ხდება');

    for (let i = 1; i <= 2; i++) {
      const bot = new Bot(url, `ბოტი-${i}`);
      bots.push(bot);
      const ack = await bot.join(code, 'saidumlo');
      if (!ack.ok) throw new Error(ack.error);
    }
    host.send('host:start');
    await until(() => host.errors.length > 0, 'შეცდომა 3 მოთამაშით დაწყებისას');
    check(host.state?.phase === 'lobby', '3 მოთამაშით თამაში არ იწყება');

    const dup = new Bot(url, 'ბოტი-1');
    extras.push(dup);
    check(!(await dup.join(code, 'saidumlo')).ok, 'დაკავებული მეტსახელით შესვლა არ ხდება');

    for (let i = 3; i < BOT_COUNT - 1; i++) {
      const bot = new Bot(url, `ბოტი-${i}`);
      bots.push(bot);
      const ack = await bot.join(code, 'saidumlo');
      if (!ack.ok) throw new Error(ack.error);
    }

    // გაგდება: დროებითი სტუმარი იკავებს მე-10 ადგილს და ჰოსტი აგდებს
    const guest = new Bot(url, 'სტუმარი');
    extras.push(guest);
    const guestAck = await guest.join(code, 'saidumlo');
    if (!guestAck.ok) throw new Error(guestAck.error);
    await until(() => host.state?.players.length === BOT_COUNT, '10 მოთამაშე ლობიში');
    const overflow = await stranger.join(code, 'saidumlo');
    check(!overflow.ok && overflow.error.includes('სავსე'), 'სავსე ოთახში (10/10) მე-11 ვერ შედის');
    bots[1].send('host:kick', { playerId: guest.id });
    await until(() => bots[1].errors.length > 0, 'არა-ჰოსტის გაგდების მცდელობა');
    check(host.state?.players.length === BOT_COUNT, 'არა-ჰოსტი ვერავის აგდებს');
    host.send('host:kick', { playerId: guest.id });
    await until(() => guest.kicked && host.state?.players.length === BOT_COUNT - 1, 'გაგდება');
    check(true, 'ჰოსტმა მოთამაშე გააგდო');

    const last = new Bot(url, `ბოტი-${BOT_COUNT - 1}`);
    bots.push(last);
    const lastAck = await last.join(code, 'saidumlo');
    if (!lastAck.ok) throw new Error(lastAck.error);

    host.send('host:updateSettings', { rounds: ROUNDS, writeSeconds: 60, maxPlayers: 10 });
    bots[2].send('host:updateSettings', { rounds: 15 });
    await until(
      () => bots.every((b) => b.state?.players.length === BOT_COUNT && b.state.settings.rounds === ROUNDS),
      'პარამეტრების სინქრონიზაცია',
    );
    check(true, `10 მოთამაშე ლობიშია, პარამეტრებს მხოლოდ ჰოსტი ცვლის (${ROUNDS} რაუნდი)`);

    // ---------- თამაში ----------
    const idOf = (i: number) => bots[i].id;
    const expectedRound = [30, 0, 0, 60, 60, 30, 55, 50, 55, 60];
    const lettersSeen: string[] = [];
    host.send('host:start');

    for (let n = 1; n <= ROUNDS; n++) {
      console.log(`\n② რაუნდი ${n}`);
      await until(() => bots.every((b) => b.state?.phase === 'reveal' && b.state.round?.number === n), 'ასოს გამოცხადება');
      check(bots.every((b) => b.state!.round!.letter === null), 'ტრიალის დროს ასო კლიენტებს არ ეგზავნება');
      await until(() => bots.every((b) => b.state?.phase === 'writing' && b.state.round?.number === n), 'წერის ფაზა');
      const letter = host.state!.round!.letter!;
      check(bots.every((b) => b.state!.round!.letter === letter), `ყველა ერთსა და იმავე ასოს ხედავს: „${letter}"`);
      check(host.state!.settings.letters.includes(letter), 'ასო ჩართული ნაკრებიდანაა');
      check(!lettersSeen.includes(letter), 'ასო ამ თამაშში არ გამეორებულა');
      lettersSeen.push(letter);

      const cats = host.state!.round!.categories;
      const answersOf = (i: number) => {
        const out: Record<string, string> = {};
        for (const c of cats) {
          if (i === 0 || i === 5) out[c.id] = `${letter}ტესტი`; // ერთნაირი პასუხი
          else if (i === 1) out[c.id] = ''; // ცარიელი
          else if (i === 2) out[c.id] = 'ჰაჰა'; // არასწორი ასო
          else if (i === 3 && c.allowLatin) out[c.id] = `${LATIN_PREFIXES[letter][0].toUpperCase()}brand`; // ლათინური ბრენდი
          else out[c.id] = `  ${letter}სიტყვა-${i} `; // უნიკალური
        }
        return out;
      };
      bots.forEach((b, i) => b.send('round:draft', { answers: answersOf(i) }));
      await sleep(80);
      check(
        bots.every((b) => b.state!.round!.table === null),
        'წერის დროს სხვისი პასუხები არავის ეგზავნება',
      );

      // რაუნდ 2-ში ბოტი-9 კარგავს კავშირს და ბრუნდება იმავე ადგილზე
      if (n === 2) {
        const before = host.state!.players.find((p) => p.id === idOf(9))!.score;
        bots[9].socket.disconnect();
        await until(() => host.state!.players.find((p) => p.id === idOf(9))?.online === false, 'ბოტი-9 გაითიშა');
        const back = await bots[9].rejoin(code);
        check(back.ok && back.playerId === idOf(9), 'გათიშული მოთამაშე ტოკენით დაბრუნდა იმავე ადგილზე');
        await until(() => bots[9].state?.phase === 'writing', 'ბოტი-9-ის მდგომარეობა');
        check(
          bots[9].state!.players.find((p) => p.id === idOf(9))!.score === before && before === expectedRound[9],
          `ქულები შენარჩუნებულია (${before})`,
        );
        check(bots[9].state!.myDraft[cats[0].id]?.includes('სიტყვა'), 'შევსებული ველებიც შენარჩუნებულია');
      }

      bots[1].send('round:stop', { answers: answersOf(1) });
      await until(() => bots[1].errors.length >= 1, 'სტოპის უარყოფა');
      check(host.state!.round!.stopBy === null, 'ცარიელი ველებით „სტოპ!" არ მუშაობს');
      const endBefore = host.state!.phaseEndsAt!;
      bots[4].send('round:stop', { answers: answersOf(4) });
      await until(() => bots.every((b) => b.state?.round?.stopBy === idOf(4)), 'სტოპ');
      const left = host.state!.phaseEndsAt! - host.state!.serverNow;
      check(host.state!.phaseEndsAt! < endBefore && left <= 10_000 * TIME_SCALE + 5, '„სტოპ!" — დანარჩენებს 10 წამი დარჩათ');

      await until(() => bots.every((b) => b.state?.phase === 'review'), 'შემოწმების ფაზა');
      // დაგვიანებული პასუხი
      bots[1].send('round:draft', { answers: answersOf(4) });
      await sleep(50);
      check(host.state!.round!.table![idOf(1)][cats[0].id].text === '', 'დაგვიანებულ პასუხს სერვერი არ იღებს');
      check(
        host.state!.round!.table![idOf(4)][cats[0].id].text === `${letter}სიტყვა-4`,
        'პასუხები გასუფთავებულია (ზედმეტი ჰარების გარეშე)',
      );

      const [c0, c1, c2] = cats;
      // ყველა (ბოტი-7-ის გარდა) უარყოფს ბოტი-7-ის ორ პასუხს
      bots.forEach((b, i) => {
        if (i === 7) return;
        b.send('review:vote', { playerId: idOf(7), categoryId: c0.id });
        b.send('review:vote', { playerId: idOf(7), categoryId: c1.id });
      });
      bots[7].send('review:vote', { playerId: idOf(7), categoryId: c2.id });
      bots[3].send('review:vote', { playerId: idOf(4), categoryId: c2.id }); // ერთი ხმა არ კმარა
      bots[3].send('host:override', { playerId: idOf(4), categoryId: c2.id, decision: 'reject' });
      await until(() => host.state!.round!.table![idOf(7)][c1.id].rejected, 'უარყოფა ხმებით');
      check(host.state!.round!.table![idOf(7)][c0.id].rejected, 'ნახევარზე მეტი ხმით პასუხი უარყოფილია');
      check(!host.state!.round!.table![idOf(4)][c2.id].rejected, 'ერთი ხმა უარყოფისთვის არ კმარა; არა-ჰოსტი ვერ გადაფარავს');
      check(host.state!.round!.table![idOf(7)][c2.id].votes.length === 0, 'საკუთარ პასუხს ვერავინ მონიშნავს');

      host.send('host:override', { playerId: idOf(7), categoryId: c0.id, decision: 'accept' });
      host.send('host:merge', { categoryId: c2.id, a: idOf(6), b: idOf(8) });
      await until(
        () => !host.state!.round!.table![idOf(7)][c0.id].rejected && host.state!.round!.table![idOf(6)][c2.id].group !== null,
        'ჰოსტის გადაფარვა და გაერთიანება',
      );
      check(true, 'ჰოსტმა გადაფარა გადაწყვეტილება და გააერთიანა ორი პასუხი');

      bots.slice(0, 9).forEach((b) => b.send('review:ready'));
      await sleep(80);
      check(host.state!.phase === 'review', 'სანამ ყველა მზად არ არის, შემოწმება გრძელდება');
      bots[9].send('review:ready');
      await until(() => bots.every((b) => b.state?.phase === 'scores'), 'ქულების ფაზა');

      const totals = host.state!.round!.roundTotals!;
      const got = bots.map((b) => totals[b.id]);
      check(JSON.stringify(got) === JSON.stringify(expectedRound), `რაუნდის ქულები სწორია: ${got.join(', ')}`);
      const table = host.state!.round!.table!;
      check(
        table[idOf(0)][c0.id].reason === 'shared' &&
          table[idOf(1)][c0.id].reason === 'empty' &&
          table[idOf(2)][c0.id].reason === 'wrongLetter' &&
          table[idOf(7)][c1.id].reason === 'rejected' &&
          table[idOf(6)][c2.id].reason === 'shared' &&
          table[idOf(3)][cats.find((c) => c.allowLatin)!.id].points === 10,
        'ყველა შემთხვევა: ერთნაირი 5, ცარიელი 0, არასწორი ასო 0, უარყოფილი 0, გაერთიანებული 5, ლათინური ბრენდი 10',
      );
      check(
        bots.every((b) => JSON.stringify(b.state!.players.map((p) => p.score)) === JSON.stringify(expectedRound.map((x) => x * n))),
        'ჯამური ცხრილი ყველა მოთამაშესთან ერთნაირია',
      );
      host.send('host:next');
    }

    console.log('\n③ ფინალი');
    await until(() => bots.every((b) => b.state?.phase === 'final'), 'ფინალი');
    const winners = [...host.state!.winners].sort();
    check(
      JSON.stringify(winners) === JSON.stringify([idOf(3), idOf(4), idOf(9)].sort()),
      'ფრე: გამარჯვება სამ მოთამაშეს შორის გაიყო',
    );
    host.send('host:newGame');
    await until(() => bots.every((b) => b.state?.phase === 'lobby'), 'ახალი თამაში');
    check(host.state!.players.every((p) => p.score === 0) && host.state!.players.length === BOT_COUNT, '„ახალი თამაში" — იგივე ოთახი, ქულები განულდა');

    host.send('room:leave');
    await until(() => bots[1].state?.players.length === BOT_COUNT - 1, 'ჰოსტი გავიდა');
    check(bots[1].state!.players.find((p) => p.isHost)?.id === idOf(1), 'ჰოსტობა გადავიდა ყველაზე დიდხანს მყოფ მოთამაშეზე');

    // ---------- 4-ზე ნაკლები მოთამაშე ----------
    console.log('\n④ თამაშის დროს 4-ზე ნაკლები მოთამაშე რჩება');
    const newHost = bots[1];
    newHost.send('host:start');
    await until(() => newHost.state?.phase === 'writing', 'მეორე თამაშის წერა');
    const letter2 = newHost.state!.round!.letter!;
    const fill = Object.fromEntries(newHost.state!.round!.categories.map((c) => [c.id, `${letter2}ბოლო`]));
    for (let i = 4; i < BOT_COUNT; i++) bots[i].send('room:leave');
    await until(() => newHost.state!.players.length === 3, 'დარჩა 3 მოთამაშე');
    check(newHost.state!.phase === 'writing', 'მიმდინარე რაუნდი არ წყდება');
    newHost.send('round:stop', { answers: fill });
    await until(() => newHost.state?.phase === 'review', 'შემოწმება');
    for (let i = 1; i <= 3; i++) bots[i].send('review:ready');
    await until(() => newHost.state?.phase === 'scores', 'ქულები');
    check(newHost.state!.awaitingHost && newHost.state!.phaseEndsAt === null, 'რაუნდი დასრულდა და თამაში ჰოსტის გადაწყვეტილებას ელოდება');
    check(newHost.state!.round!.roundTotals![newHost.id] === 20 * newHost.state!.round!.categories.length, 'ერთადერთი პასუხი ყველა კატეგორიაში — 20 ქულა');
    newHost.send('host:continue');
    await until(() => newHost.state?.phase === 'reveal' && newHost.state.round?.number === 2, 'გაგრძელება');
    check(true, 'ჰოსტმა გააგრძელა თამაში');

    console.log(`\n✅ ყველაფერი მუშაობს: ${checks} შემოწმება, ${BOT_COUNT} ბოტი, ${ROUNDS} რაუნდი.\n`);
  } finally {
    for (const b of [...bots, ...extras]) b.socket.disconnect();
    await close();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(`\n❌ ${err.message}\n`);
    process.exit(1);
  },
);
