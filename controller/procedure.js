const router = require('express').Router();

const { body } = require('express-validator');
const { ProcedureModel, isDurationCorrect } = require('../models/procedureModel');
const EventModel = require('../models/eventModel');
const { verifyRole } = require('../middleware/isAuthorized');
const { isAuth } = require('../middleware/isAuthenticated');

router.post(
  '/create',
  isAuth,
  body('duration')
    .isDivisibleBy(15)
    .withMessage('Délka musí být dělitelná 15 minutami.'),
  async (req, res) => {
    const procedure = req.body;
    if (!verifyRole(procedure.typeOfService, req.user)) return res.sendStatus(403);
    try {
      const procedureModel = ProcedureModel(procedure);
      await procedureModel.save();
      return res.status(201).json(procedure);
    } catch (err) {
      console.error(err);
      return res.status(500).json(err);
    }
  },
);

router.get('/get', async (req, res) => {
  let procedures;
  const { type, typeOfService } = req.query;
  const filter = {
    disabled: false,
    typeOfService,
  };
  if (type) filter.type = type;

  try {
    procedures = await ProcedureModel.find(filter).lean();
    return res.status(200).json(procedures);
  } catch (err) {
    console.log(err);
    return res.status(500).json(err);
  }
});

router.delete('/delete', isAuth, async (req, res) => {
  const { _id } = req.body;
  try {
    const procedure = await ProcedureModel.find({ _id }).lean();
    if (!verifyRole(procedure.typeOfService, req.user)) return res.sendStatus(403);
    if (!procedure.length) return res.sendStatus(404);

    const foundEvents = EventModel.find({ procedureId: _id });
    if (foundEvents.length) await ProcedureModel.updateOne({ _id }, { disabled: true }).lean();
    else await ProcedureModel.deleteOne({ _id }).lean();

    return res.sendStatus(200);
  } catch (err) {
    console.log(err);
    return res.status(500).send(err.toString());
  }
});

router.put('/update', isAuth, async (req, res) => {
  const {
    _id, price, name, duration, type, typeOfService,
  } = req.body;
  if (!verifyRole(typeOfService, req.user)) return res.sendStatus(403);
  try {
    const update = {
      name: (!name) ? undefined : name,
      price: (price && price >= 0) ? price : undefined,
      duration: (duration && isDurationCorrect(duration) ? duration : undefined),
      type,
      typeOfService,
    };
    const result = await ProcedureModel.findOneAndUpdate({ _id }, update, { new: true }).lean();
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.toString());
  }
});

module.exports = router;
