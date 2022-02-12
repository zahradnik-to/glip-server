const router = require('express').Router();

const ProcedureModel = require('../models/procedureModel');
const EventModel = require('../models/eventModel');
// Todo sort auth

router.post('/create', async (req, res) => {
  const procedure = req.body;
  const { isAdmin } = req.user;
  try {
    if (procedure.typeOfService !== req.user.role && !isAdmin) {
      throw new Error('Staff member does not have the authority to create this procedure!');
    }
    const procedureModel = ProcedureModel(procedure);
    await procedureModel.save();
    res.status(201).json(procedure);
  } catch (err) {
    res.status(501).json(err);
  }
});

router.get('/get', async (req, res) => {
  let procedures;
  const { typeOfService } = req.query;
  const { isAdmin } = req.user;
  try {
    if (!typeOfService && isAdmin) {
      procedures = await ProcedureModel.find().lean();
    } else {
      procedures = await ProcedureModel.find({ typeOfService, disabled: false }).lean();
    }
    res.status(200).json(procedures);
  } catch (err) {
    console.warn('procedure/get error');
    console.log(err);
    res.status(500).json(err);
  }
});

router.delete('/delete', async (req, res) => {
  const { _id } = req.body;
  try {
    const procedure = await ProcedureModel.find({ _id }).lean();
    if (!procedure.length) throw new Error('Procedure set for deletion not found!');

    // Todo only delete procedure if it was never used
    const foundEvents = EventModel.find({ procedureId: _id });
    let result;
    if (foundEvents.length) {
      result = await ProcedureModel.updateOne({ _id }, { disabled: true });
    } else {
      result = await ProcedureModel.deleteOne({ _id });
    }

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
