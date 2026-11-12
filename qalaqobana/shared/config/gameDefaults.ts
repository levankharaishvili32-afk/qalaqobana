/** თამაშის ლიმიტები და ნაგულისხმევი მნიშვნელობები */
export const LIMITS = {
  minPlayers: 4,
  maxPlayers: 10,
  rounds: { min: 3, max: 15, def: 8 },
  writeSeconds: { min: 60, max: 180, def: 90 },
  nameMax: 16,
  roomNameMax: 30,
  passwordMax: 30,
  answerMax: 40,
  customCategoriesMax: 6,
  categoryNameMax: 20,
} as const;

/** დროები მილიწამებში */
export const TIMING = {
  /** ასოების "ტრიალი" */
  revealMs: 2500,
  /** ათვლა ასოს გამოჩენის შემდეგ */
  countdownMs: 3000,
  /** რამდენი რჩებათ დანარჩენებს "სტოპ!"-ის შემდეგ */
  stopGraceMs: 10_000,
  /** შემოწმების ფაზის ხანგრძლივობა */
  reviewMs: 90_000,
  /** ქულების ეკრანი, სანამ შემდეგი რაუნდი ავტომატურად დაიწყება */
  scoresMs: 20_000,
  /** ქსელის დაყოვნების კომპენსაცია წერის დასრულებისას */
  submitGraceMs: 250,
  /** რამდენ ხანში გადადის ჰოსტობა, თუ ჰოსტი გაითიშა */
  hostOfflineMs: 60_000,
  /** ლობიში გათიშული მოთამაშის ადგილი ამდენ ხანში თავისუფლდება */
  lobbyOfflineMs: 60_000,
  /** ცარიელი ოთახი ამდენ ხანში იშლება */
  emptyRoomMs: 30 * 60 * 1000,
} as const;
