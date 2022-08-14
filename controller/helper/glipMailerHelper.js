const glipMailHelper = {
  reservation: {
    create: {
      subject: 'Potrvrzení rezervace',
      message: (reserv) => getReservationCreateMessage(reserv),
    },
    update: {
      subject: 'Úprava rezervace',
      message: (reserv) => getReservationUpdateMessage(reserv),
    },
    cancel: {
      subject: 'Stornování rezervace',
      message: (reserv) => getReservationCancelMessage(reserv),
    },
  },
};

function getReservationCreateMessage(event) {
  const addProcNameList = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const addProc of event.additionalProcedures) {
    addProcNameList.push(addProc.name);
  }
  return (`
    Dobrý den,\n 
    Vaše rezervace na jméno ${event.lastname} proběhla úspěšně.\n
    Termín rezervace: ${formatDateToString(event.start)} - ${formatTimeToString(event.end)}\n
    Studio: ${event.typeOfService}\n
    Služba: ${event.procedureName}\n
    Dopňkové služby: ${addProcNameList.join(', ')}\n
    Váš telefon: +${event.phoneNumber}\n
    Očekávaná cena: ${event.price}Kč\n
    \n\n
    S pozdravem 
    Salon Glip
    `);
}

function getReservationUpdateMessage(event) {
  const addProcNameList = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const addProc of event.additionalProcedures) {
    addProcNameList.push(addProc.name);
  }
  return (`
    Dobrý den,\n 
    Vaše rezervace na jméno ${event.lastname} byla upravena. Současná podoba objednávky:\n
    Termín rezervace: ${formatDateToString(event.start)} - ${formatTimeToString(event.end)}\n
    Studio: ${event.typeOfService}\n
    Služba: ${event.procedureName}\n
    Dopňkové služby: ${addProcNameList.join(', ')}\n
    Váš telefon: +${event.phoneNumber}\n
    Očekávaná cena: ${event.price}Kč\n
    \n\n
    S pozdravem 
    Salon Glip
    `);
}

function getReservationCancelMessage(event) {
  return (`
    Dobrý den,\n 
    Vaše rezervace na jméno ${event.lastname} byla stornována.\n
    Termín stornované rezervace: ${formatDateToString(event.start)} - ${formatTimeToString(event.end)}\n
    Studio: ${event.typeOfService}\n
    Procedura: ${event.procedureName}\n
    \n\n
    S pozdravem\n
    Salon Glip
    `);
}

function formatDateToString(date) {
  return new Date(date).toLocaleString('cs', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: 'numeric',
  });
}

function formatTimeToString(date) {
  return new Date(date).toLocaleString('cs', {
    hour: '2-digit',
    minute: 'numeric',
  });
}

module.exports = { glipMailHelper };
