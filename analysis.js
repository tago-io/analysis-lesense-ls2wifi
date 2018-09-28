 /*
  * Analysis to get data from the Lesense API
  *
  * Learn how to use it
  * Tutorial: https://tago.elevio.help/en/articles/136
  */


const TagoAnalysis = require('tago/analysis');
const TagoDevice = require('tago/device');
const TagoUtils = require('tago/utils');
const axios = require('axios');
const moment = require('moment');

// The function formatDate, format the date from unix to human date
function formatDate(unix_time) {
  const date = moment.unix(unix_time).format('YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
  return date;
}

// The function getData will get data from lesense API
async function getData(lesense_token, last_collected) {
  let url;
  if (!last_collected) {
    url = `https://lesense.logicae.com.br/api/1.0/sensor?token=${lesense_token}`;
  } else {
    last_collected = Number(last_collected) + 1;
    url = `https://lesense.logicae.com.br/api/1.0/sensor?token=${lesense_token}&after=${last_collected}`;
  }
  const request_config = {
    method: 'get',
    url,
  };

  try {
    const req = await axios(request_config);
    return req.data;
  } catch (err) {
    return err.response.data;
  }
}

// The function parse will run when you execute your analysis
async function parse(context) {
  context.log('Running');
  const environment = TagoUtils.env_to_obj(context.environment);

  // Check if "device_token" and "lesense_token" exists on TagoIO anlysis enviroment variables
  if (!environment.device_token) return context.log('Missing device_token environment var');
  if (!environment.lesense_token) return context.log('Missing lesense_token environment var');

  const tagodev = new TagoDevice(environment.device_token);
  // Find the last import from lesense
  const last_collected = await tagodev.find({ variable: 'last_send', query: 'last_value' }).then(r => r[0]);
  // Check if TagoIO has already searched for data in lesense ever.
  // If TagoIO analysis already searched, the search is done from the last record to not duplicate the data.
  const getdata = last_collected ? await getData(environment.lesense_token, last_collected.value) : await getData(environment.lesense_token);
  const tagodata = [];

  // Transform lesense data to TagoIO variables
  getdata.items.map((item) => {
    let variable;
    if (item.type === 'General') variable = `${String(item.type).toLowerCase()}_${item.port}`;
    else if (item.type === 'Switch') variable = `${String(item.type).toLowerCase()}_${item.port}`;
    else variable = String(item.type).toLowerCase();

    return tagodata.push({
      variable,
      value: item.value,
      time: formatDate(item.collected),
      serie: item.collected,
      unit: item.type === 'Temperature' ? '°C' : '',
    });
  });
  if (getdata.items.length > 0) tagodata.push({ variable: 'last_send', value: getdata.items[0].collected });
  // send data to TagoIO
  if (tagodata.length > 0) await tagodev.insert(tagodata).then(context.log);
  context.log('Run successfully finished');
}

// The analysis token in only necessary to run the analysis outside Tago
module.exports = new TagoAnalysis(parse, 'your-analysis-token-here');

