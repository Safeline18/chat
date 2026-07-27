const app = require('../server');
const { initDatabase } = require('../src/database');

module.exports = async (req, res) => {
  try {
    await initDatabase();
  } catch (e) {
    console.warn('⚠️ Serverless DB init warning:', e.message);
  }
  return app(req, res);
};
