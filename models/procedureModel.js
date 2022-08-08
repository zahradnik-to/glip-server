const mongoose = require('mongoose');

const PROCEDURE_DURATION_GRANULARITY = 15;

const isDurationCorrect = (duration) => duration % PROCEDURE_DURATION_GRANULARITY === 0;

const ProcedureSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  typeOfService: {
    type: String,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const ProcedureModel = mongoose.model('Procedure', ProcedureSchema);
module.exports = { ProcedureModel, isDurationCorrect, PROCEDURE_DURATION_GRANULARITY };
