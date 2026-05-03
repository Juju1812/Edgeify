import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COUNTRIES = ["US", "GB", "CA", "AU", "DE", "FR", "JP", "KR", "BR", "MX", "IN", "NL", "SE", "ES", "IT"];
const NAMES = [
  "ZYZZ", "TROY", "JREMY", "KAVI", "OREN", "MIKO", "LIAM", "AKIRA", "RYU", "DRAGO",
  "FINN", "KAI", "SOLO", "ROMA", "DEX", "BLAZE", "AXEL", "TANK", "VIPER", "JINX",
  "NOVA", "ZEN", "RIO", "TAVO", "KASE", "WULF", "VOID", "EMBER", "RAGE", "FROST",
  "SHADE", "REX", "JET", "ORBIT", "FANG", "COBRA", "ECHO", "FLARE", "GHOST", "HEX",
  "IRON", "JAGER", "KILO", "LYNX", "MAVEN", "NEON", "ONYX", "PRISM", "QUARK", "RIFT"
];

function randomElo(): number {
  // Bell-ish distribution centered ~1100, capped at the top.
  const r = (Math.random() + Math.random() + Math.random()) / 3;
  return Math.round(400 + r * 1600);
}

function randomCode() {
  return Math.floor(Math.random() * 9000) + 1000;
}

async function main() {
  console.log("Seeding 50 fake leaderboard users...");

  for (let i = 0; i < NAMES.length; i++) {
    const username = `${NAMES[i]}${randomCode()}`;
    const elo = randomElo();
    const wins = Math.floor(Math.random() * 200);
    const losses = Math.floor(Math.random() * 150);

    const user = await prisma.user.upsert({
      where: { username },
      update: {},
      create: {
        username,
        name: username,
        countryCode: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
        isOver18: true,
        consentedAt: new Date(),
        image: `https://i.pravatar.cc/200?u=${encodeURIComponent(username)}`
      }
    });

    await prisma.rating.upsert({
      where: { userId: user.id },
      update: { elo, wins, losses, peakElo: Math.max(elo, 800) },
      create: {
        userId: user.id,
        elo,
        peakElo: Math.max(elo, 800),
        wins,
        losses,
        placementsLeft: 0
      }
    });
  }

  console.log("Done. Run `npm run prisma:studio` to inspect.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
