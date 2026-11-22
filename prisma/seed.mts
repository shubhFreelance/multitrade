// Run with `npm run db:seed`. Safe to re-run: it only creates rows that are missing and never overwrites edits.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// Money in paise, percentages in basis points (100 bps = 1%). Items marked CONFIRM are in docs/OPEN_QUESTIONS.md.
const config: Record<string, unknown> = {
  company: { name: "Saksham Multitrade Pvt Ltd", cin: "", address: "", registrations: [] }, // CONFIRM: real legal details
  overdueAfterDays: 10, // CONFIRM #2
  reminderDaysBefore: 3, // "due soon" reminder this many days before the due date
  defaultAfterMissedInARow: 2, // CONFIRM #2
  bonusUnlock: { scooter: 6, goldChain: 12, scope: "ENROLMENT" }, // paid months to unlock each prize; CONFIRM #5: or "CUMULATIVE"
  bonusRewards: { scooters: 5, goldChains: 1 },
  goldGstBps: 300,
  tdsBps: 200, // CONFIRM #8 with the CA (Section 194H)
  recruitmentCampaign: {
    // CONFIRM #7
    start: "2026-11-17",
    end: "2026-12-31",
    countsAfterPaidInstallments: 1,
    tiers: [
      { enrolments: 30, bonus: 1_500_00 },
      { enrolments: 50, bonus: 4_000_00 },
      { enrolments: 100, bonus: 20_000_00 },
    ],
  },
};

const schemes = [
  // CONFIRM #3: Upahar tier table (₹80–₹200 per paid installment) is unknown, so tiers is empty until the client sends it.
  { code: "UPAHAR", nameEn: "Upahar Plan", nameHi: "उपहार योजना", commissionRule: { type: "TIER", tiers: [] } },
  { code: "MANPASAND", nameEn: "Manpasand Plan", nameHi: "मनपसंद योजना", commissionRule: { type: "FLAT", amount: 50_00 } },
  { code: "GOLD", nameEn: "Gold Plan", nameHi: "गोल्ड योजना", commissionRule: { type: "PERCENT", bps: 100 } },
] as const;

const panchayats = ["Arang", "Abhanpur", "Tilda"];
const villages = ["Mandir Hasaud", "Kurud", "Gobra Navapara", "Kharora", "Nawagaon", "Bhatagaon"];
const firstNames = ["Ramesh", "Sunita", "Mahesh", "Geeta", "Raju", "Kavita", "Santosh", "Pushpa", "Dinesh", "Lata"];
const lastNames = ["Sahu", "Verma", "Yadav"];

async function seedSettings() {
  for (const [key, value] of Object.entries(config)) {
    await db.config.upsert({ where: { key }, create: { key, value: value as object }, update: {} });
  }
  for (const s of schemes) {
    const scheme = await db.scheme.upsert({
      where: { code: s.code },
      create: { ...s, installmentAmount: 2_000_00, tenureMonths: 12 },
      update: {},
    });
    await db.batch.upsert({
      where: { schemeId_number: { schemeId: scheme.id, number: 1 } },
      create: { schemeId: scheme.id, number: 1, startMonth: new Date("2026-12-01"), size: 2500, winnersPerDraw: 10 },
      update: {},
    });
  }
}

// Fake people with made-up phone numbers. Never in production: anyone owning these numbers could log in.
async function seedDemoUsers() {
  await db.user.upsert({
    where: { phone: "9999999999" },
    create: { phone: "9999999999", name: "Super Admin", role: "SUPER_ADMIN", language: "en" },
    update: {},
  });

  for (let i = 1; i <= 3; i++) {
    const phone = `980000000${i}`;
    await db.user.upsert({
      where: { phone },
      create: {
        phone,
        name: `${firstNames[i]} ${lastNames[i % 3]} (Agent)`,
        role: "AGENT",
        // Agent 3 is left unapproved so the approval flow has someone to approve.
        agentProfile: { create: { panchayat: panchayats[i - 1], approved: i !== 3 } },
      },
      update: {},
    });
  }

  for (let i = 1; i <= 30; i++) {
    const phone = `97000000${String(i).padStart(2, "0")}`;
    const village = villages[i % villages.length];
    await db.user.upsert({
      where: { phone },
      create: {
        phone,
        name: `${firstNames[i % 10]} ${lastNames[i % 3]}`,
        memberProfile: { create: { village, address: `Ward ${(i % 9) + 1}, ${village}`, nominee: "Spouse" } },
      },
      update: {},
    });
  }
}

await seedSettings();
if (process.env.NODE_ENV === "production") {
  console.log("Seeded settings. Skipped demo users (production).");
} else {
  await seedDemoUsers();
  console.log("Seeded settings and demo users.");
}
await db.$disconnect();
