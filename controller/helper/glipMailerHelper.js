const glipMailHelper = {
  MAILHOG_PORT: 1025,
  reservation: {
    create: {
      subject: 'Potrvrzení rezervace',
      message: (ev) => getReservationCreateMessage(ev),
    },
    cancel: {
      subject: 'Stornování rezervace',
      message: (ev) => getReservationCancelMessage(ev),
    },
    edit: {
      subject: 'Úprava rezervace',
      message: (ev) => getReservationEditMessage(ev),
    },
  },
};

function getReservationCreateMessage(event) {
  return (`
    Dobrý den,\n 
    Vaše rezervace na jméno ${event.lastname} proběhla úspěšně.\n
    Termín rezervace: ${formatDateToString(event.start)} - ${formatTimeToString(event.end)}\n
    Studio: ${event.typeOfService}\n
    Procedura: ${event.procedureName}\n
    Dopňkové procedury: TODO\n
    Váš telefon: +${event.phoneNumber}\n
    Očekávaná cena: ${event.price}\n
    \n\n
    S pozdravem\n
    Salon Glip
    `);
}

function getReservationCancelMessage(event) {
  return (`
    Dobrý den,\n 
    Vaše rezervace na jméno ${event.lastname} byla stornována.\n
    Termín rezervace: ${formatDateToString(event.start)} - ${formatTimeToString(event.end)}\n
    Studio: ${event.typeOfService}\n
    Procedura: ${event.procedureName}\n
    Dopňkové procedury: TODO\n
    Váš telefon: +${event.phoneNumber}\n
    Očekávaná cena: ${event.price}\n
    \n\n
    S pozdravem\n
    Salon Glip
    `);
}

function getReservationEditMessage(event) {
  return (`
    Dobrý den,\n 
    Vaše rezervace na jméno ${event.lastname} byla upravena následovně: \n
    Termín rezervace: ${formatDateToString(event.start)} - ${formatTimeToString(event.end)}\n
    Studio: ${event.typeOfService}\n
    Procedura: ${event.procedureName}\n
    Dopňkové procedury: TODO\n
    Váš telefon: +${event.phoneNumber}\n
    Očekávaná cena: ${event.price}\n
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
