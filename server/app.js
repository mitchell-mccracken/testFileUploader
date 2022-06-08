// APP FILE - this is a test to set 
const express = require('express');
const mongoose = require('mongoose');
const busboy = require('busboy');
const { drive_v3, google } = require('googleapis');
require('dotenv').config();


const app = express();
const PORT = 3000;

const apiKey = process.env.G_API_KEY;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.listen(PORT, (error) =>{
  if(!error)
      console.log("Server is Successfully Running, and App is listening on port "+ PORT)
  else 
      console.log("Error occurred, server can't start", error);
  }
);



//connect to mongo
mongoose.connect(process.env.MONGO_DB_URI);
mongoose.connection.once('open', () => {
  console.log(`mongo connected at ${process.env.MONGO_DB_URI}`);
})



////////////
// ROUTES //
////////////

app.get('/test', testRoute);

app.post('/upload', upload);



// dump all other requests
app.all('*', (_req, res) => res.sendStatus(404));







///////////////
// FUNCTIONS //
///////////////

function testRoute(req, res){
  console.log('------ test route hit -------');
  res.status(200).send('Test route hit!');
};

async function upload(req, res){
  console.log('------ upload route --------');
  const folderId = '1C8G-Yy0d1Zzw9SzFdNuu6Qj3C1ANWnKc'
  console.log(req.body)
  console.log(req.headers)

  const { headers } = req;
  const bb = busboy({ headers });
  bb._writableState.autoDestroy = false;

  bb.on('close', () => res.sendStatus(201));


  bb.on('file', (_name, fileStream, fileInfo) => {
    console.log('------file')

    const { filename, mimeType } = fileInfo;
    const requestBody = {
      mimeType,
      name: filename,
      parents: [ folderId ],
    };

    const media = {
      body: fileStream,
    };

    // const drive = GetGoogleDrive()
    const drive = google.drive({
      version: 'v3',
      auth: apiKey,
    })
    drive.files.create({
      media,
      requestBody,
      fields: 'id',
      supportsAllDrives: true
    })
    .then(() => bb.destroy())
    .catch((e) => bb.emit('error', e));
  });

  req.on('aborted', async () => {

    console.log('-------- aborted')
    if (res.headersSent) return;

    req.unpipe(bb);
    bb.removeAllListeners('close');
    bb.removeAllListeners('error');

    res.set('Connection', 'close');
    res.status(408).send('Upload cancelled.');
  });

  bb.on('error', (e) => {
    console.log(e);

    if (res.headersSent) return;

    req.unpipe(bb);

    bb.removeAllListeners('close');
    bb.destroy();

    res.set('Connection', 'close');

    // TODO
    // We need to send appropriate status not just 413, as there will be different sources
    res.status(413).send('Upload limit exceeded. Please wait a minute and try again.');
  });






  res.sendStatus(200)
};