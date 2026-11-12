/**
 * Vercel-ის შესასვლელი წერტილი: იგივე სერვერი, რაც ლოკალურად (server/index.ts),
 * ოღონდ პორტს Vercel თავად ხსნის. მისამართი: /api/server
 *
 * ყურადღება: Vercel-ზე ოთახები ფუნქციის მეხსიერებაშია. თუ Vercel-მა ახალი ასლი
 * გაუშვა ან ძველი გააჩერა, მიმდინარე თამაში იკარგება (იხ. README, ნაწილი 5).
 */
import { createApp } from '../server/app.js';

const { server } = createApp({ pathPrefix: '/api/server' });

export default server;
