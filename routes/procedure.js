const router = require('express').Router();

const ProcedureModel = require('../models/procedureModel');
const verifyToken = require('../middleware/isAuthenticated');
const verifyRole = require('../middleware/isAuthorized');

router.post('/create', verifyToken, verifyRole('admin'), async (req, res) => {
  // Todo add authorization
  const procedure = req.body;
  const procedureModel = ProcedureModel(procedure);
  await procedureModel.save();
  res.json(procedure).status(201);
});

router.get('/get', async (req, res) => {
  const { typeOfService } = req.query;
  const procedures = await ProcedureModel.find({ typeOfService }).lean()
    .then((result) => result)
    .catch((err) => console.log(err));

  res.json(procedures).status(201);
});

// router.delete('/delete', async (req, res) => {
//
// });

// router.put('/update', async (req, res) => {
//
// });

module.exports = router;
