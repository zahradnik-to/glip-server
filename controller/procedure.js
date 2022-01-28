const router = require('express').Router();

const ProcedureModel = require('../models/procedureModel');
// Todo sort auth
const verifyToken = require('../middleware/isAuthenticated');
const verifyRole = require('../middleware/isAuthorized');

router.post('/create', async (req, res) => {
  const procedure = req.body;
  try {
    const procedureModel = ProcedureModel(procedure);
    await procedureModel.save();
    res.status(201).json(procedure);
  } catch (err) {
    res.status(501).json(err);
  }
});

router.get('/get', async (req, res) => {
  let procedures;
  const typeOfService = req.query.tos;
  const isAdmin = true; // Todo admin authentication
  try {
    if (!typeOfService && isAdmin) {
      procedures = await ProcedureModel.find().lean();
    } else {
      procedures = await ProcedureModel.find({ typeOfService }).lean();
    }
    res.status(200).json(procedures);
  } catch (err) {
    console.warn('procedure/get error');
    console.log(err);
    res.status(500).json(err);
  }
});

router.delete('/delete', async (req, res) => {
  const { id } = req.body;
  try {
    const procedure = await ProcedureModel.find({ _id: id }).lean();
    if (!procedure.length) throw new Error('Procedure set for deletion not found!');

    const result = await ProcedureModel.deleteOne({ _id: id });
    res.status(200).json(result);
  } catch (err) {
    console.warn('procedure/delete error');
    console.log(err);
    res.status(500).send(err.toString());
  }
});

router.put('/update', async (req, res) => {
  const {
    _id, name, duration, typeOfService,
  } = req.body;
  try {
    const update = {
      name,
      duration,
      typeOfService,
    };
    const result = await ProcedureModel.findOneAndUpdate({ _id }, update, { new: true }).lean();
    res.status(200).json(result);
  } catch (err) {
    console.warn('procedure/update error');
    console.log(err);
    res.status(500).send(err.toString());
  }
});

module.exports = router;
