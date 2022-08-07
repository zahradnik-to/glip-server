const mongoose = require('mongoose');

const PROCEDURE_DURATION_DIVISIBILITY = 15;

const isDurationCorrect = (duration) => duration % PROCEDURE_DURATION_DIVISIBILITY === 0;

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
module.exports = { ProcedureModel, isDurationCorrect };
