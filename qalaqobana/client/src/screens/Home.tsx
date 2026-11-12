import { useEffect, useState, type FormEvent } from 'react';
import { LIMITS } from '../../../shared/config/gameDefaults';
import { clearNotice, createRoom, joinRoom, roomInfo, storage, urlCode, useStore } from '../socket';

export function Home() {
  const { connected, rejoining, notice } = useStore();
  const linkCode = urlCode();
  const [tab, setTab] = useState<'create' | 'join'>(linkCode ? 'join' : 'create');
  const [nickname, setNickname] = useState(storage.get('nickname') ?? '');
  const [roomName, setRoomName] = useState('');
  const [code, setCode] = useState(linkCode ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkRoom, setLinkRoom] = useState<{ name: string; hasPassword: boolean } | null>(null);

  // ლინკით შემოსულს ვაჩვენებთ ოთახის სახელს და პაროლის ველს მხოლოდ საჭიროებისას
  useEffect(() => {
    if (!linkCode || !connected) return;
    void roomInfo(linkCode).then((info) => {
      if (info.ok) setLinkRoom(info);
      else setError('ეს ოთახი აღარ არსებობს. შეგიძლიათ ახალი შექმნათ.');
    });
  }, [linkCode, connected]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    clearNotice();
    const name = nickname.trim();
    if (!name) return setError('შეიყვანეთ მეტსახელი');
    storage.set('nickname', name);
    setBusy(true);
    const ack =
      tab === 'create'
        ? await createRoom({ roomName: roomName.trim() || `${name}-ს ოთახი`, nickname: name, password })
        : await joinRoom({ code: code.trim().toUpperCase(), nickname: name, password });
    setBusy(false);
    if (!ack.ok) setError(ack.error);
  };

  if (rejoining) {
    return <div className="card mt-10 text-center font-bold">ვბრუნდებით ოთახში…</div>;
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-5 mt-4 text-center text-white">
        <h1 className="text-4xl font-extrabold drop-shadow-lg sm:text-5xl">ქალაქობანა</h1>
        <p className="mt-2 font-semibold text-white/90">ითამაშე მეგობრებთან ერთად, ონლაინ 🎉</p>
      </div>

      {notice && (
        <div className="mb-3 rounded-2xl bg-amber-300 px-4 py-3 text-center font-bold text-violet-950 shadow-lg">
          {notice}
        </div>
      )}

      <div className="card">
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-violet-100 p-1">
          {(['create', 'join'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setError(null);
              }}
              className={`rounded-xl py-2.5 text-sm font-extrabold transition ${
                tab === t ? 'bg-white text-fuchsia-600 shadow' : 'text-violet-500'
              }`}
            >
              {t === 'create' ? 'ოთახის შექმნა' : 'შესვლა კოდით'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {tab === 'join' && linkRoom && code.toUpperCase() === linkCode && (
            <div className="rounded-2xl bg-fuchsia-50 px-4 py-3 text-center">
              <div className="text-xs font-semibold text-fuchsia-600">გეპატიჟებიან ოთახში</div>
              <div className="text-lg font-extrabold">{linkRoom.name}</div>
            </div>
          )}

          <div>
            <label className="label" htmlFor="nickname">
              მეტსახელი
            </label>
            <input
              id="nickname"
              className="field"
              value={nickname}
              maxLength={LIMITS.nameMax}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="მაგ. ნინო"
              autoComplete="nickname"
            />
          </div>

          {tab === 'create' ? (
            <div>
              <label className="label" htmlFor="roomName">
                ოთახის სახელი
              </label>
              <input
                id="roomName"
                className="field"
                value={roomName}
                maxLength={LIMITS.roomNameMax}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="მაგ. პარასკევის თამაში"
              />
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="code">
                ოთახის კოდი
              </label>
              <input
                id="code"
                className="field text-center font-mono text-2xl uppercase tracking-[0.3em]"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                placeholder="ABC123"
                autoCapitalize="characters"
                autoComplete="off"
              />
            </div>
          )}

          {(tab === 'create' || !linkRoom || linkRoom.hasPassword || code.toUpperCase() !== linkCode) && (
            <div>
              <label className="label" htmlFor="password">
                {tab === 'create' ? 'პაროლი (არასავალდებულო)' : 'პაროლი (თუ ოთახს აქვს)'}
              </label>
              <input
                id="password"
                className="field"
                value={password}
                maxLength={LIMITS.passwordMax}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}

          {error && (
            <div className="rounded-2xl bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700">{error}</div>
          )}

          <button className="btn-primary w-full text-lg" disabled={busy || !connected}>
            {!connected ? 'ვუკავშირდები…' : tab === 'create' ? 'ოთახის შექმნა' : 'შესვლა'}
          </button>
        </form>
      </div>

      <div className="mt-4 rounded-3xl bg-white/15 p-4 text-sm font-semibold leading-relaxed text-white backdrop-blur">
        <div className="mb-1 font-extrabold">როგორ ვითამაშოთ?</div>
        ყოველ რაუნდში ირჩევა შემთხვევითი ასო. ჩაწერე ამ ასოზე დაწყებული სიტყვა თითოეულ კატეგორიაში. რაც
        უფრო იშვიათია შენი პასუხი, მით მეტი ქულა: 20 — მხოლოდ შენ გაქვს პასუხი, 10 — უნიკალური, 5 —
        სხვასაც იგივე აქვს.
      </div>
    </div>
  );
}
