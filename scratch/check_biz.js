const { initDatabase, Business } = require('../src/database');

async function check() {
  await initDatabase();
  const list = await Business.find({}).lean();
  console.log('--- BUSINESSES IN DB ---');
  list.forEach(b => {
    console.log(`ID: ${b._id || b.id}`);
    console.log(`Name: ${b.name_ar || b.name}`);
    console.log(`Phone: ${b.phone}`);
    console.log(`WhatsApp: ${b.whatsapp}`);
    console.log('------------------------');
  });
  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
