const mongoose = require('mongoose');

const ProcedureSchema = mongoose.Schema({
  name: {
    type: String,
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
module.exports = ProcedureModel;
