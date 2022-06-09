// APP FILE - this is a test to set 
const express = require('express');
const mongoose = require('mongoose');
const busboy = require('busboy');
const { drive_v3, google, clouddebugger_v2 } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const multer = require('multer');
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
app.post('/search', search);
app.post('/delete', remove)



// dump all other requests
app.all('*', (_req, res) => res.sendStatus(404));







///////////////
// FUNCTIONS //
///////////////

async function remove(req, res){
  //google auth setup
  const credentials = {
    private_key: process.env.SA_privateKey.replace(/\\n/g, '\n'),
    client_email: process.env.SA_clientEmail
  };
  const auth = new GoogleAuth({ 
    credentials, 
    scopes: 'https://www.googleapis.com/auth/drive'
  })

  const service = google.drive({
    version: 'v3',
    auth,
  });

  const files = await service.files.list({
    // q: `parents='0AG-3k0Os7-2KUk9PVA'`,
    fields: 'files(id,name, trashed, parents)'
  });
  console.log(files.data.files)
  console.log(files.data.files.length)
  console.log(files.data.files[0]);
  console.log(files.data.files[0].id);

  const result = await service.files.delete({fileId: `'${files.data.files[0].id}'`});
  console.log(result);

  res.sendStatus(200)

}


async function search(_req, res){
  console.log('---- in search function');
  const folderId = '1C8G-Yy0d1Zzw9SzFdNuu6Qj3C1ANWnKc'    //to /testFolder
  // const folderId = '1f7l0TJ_Pfm9YO2tfcyN3N1J6I7aaUawX'

  //google auth setup
  const credentials = {
    private_key: process.env.SA_privateKey.replace(/\\n/g, '\n'),
    client_email: process.env.SA_clientEmail
  };
  const auth = new GoogleAuth({ 
    credentials, 
    scopes: 'https://www.googleapis.com/auth/drive'
  })

  const service = google.drive({
    version: 'v3',
    auth,
  })
  // const customerId = "c_id_1"

  // await service.files.delete({});
  // console.log('files deleted')

  const files = await service.files.list({
    // q: 'trashed=false',
    // q: 'hidden=false',
    // q: 'name=\'timesheets_mongo_commands.txt\'',
    // q: 'id=\'1QcB7mnKzIzdVz04LaOnXPrTQweNPhTwb\'',
    // q: 'mimeType=\'text/plain\'',
    // q: 'mimeType=\'application/vnd.google-apps.folder\'',
    // q: 'name=\'testFolder\'',
    // q: `name='${customerId}'`,
    // q: "mimeType='application/vnd.google-apps.folder', 'name='testFolder''",
    // q: 'parents=\'1C8G-Yy0d1Zzw9SzFdNuu6Qj3C1ANWnKc\'',   //sub folder
    // q: 'parents=\'1f7l0TJ_Pfm9YO2tfcyN3N1J6I7aaUawX\'',
    // q: `parents='0AG-3k0Os7-2KUk9PVA'`,
    fields: 'files(id,name, trashed, parents)'

  });
  console.log(files.data.files)
  console.log(files.data.files.length)

  

  res.sendStatus(200)


}

function testRoute(req, res){
  console.log('------ test route hit -------');
  res.status(200).send('Test route hit!');
};

//////////////////////////////
// UPLOAD FILE FROM POSTMAN //
//////////////////////////////
async function upload(req, res){
  console.log('------ upload route --------');
  
  // const folderId = '1C8G-Yy0d1Zzw9SzFdNuu6Qj3C1ANWnKc'    //to /testFolder
  const folderId = '1f7l0TJ_Pfm9YO2tfcyN3N1J6I7aaUawX'

  const { headers } = req;
  const bb = busboy({ headers });
  req.pipe(bb)
  bb._writableState.autoDestroy = false;

  let data;


  bb.on('field', (fieldname, val) => {
    data = JSON.parse(val);
  })


  


  bb.on('file', async (_name, fileStream, fileInfo) => {
    // console.log(_name, fileStream, fileInfo);
    // console.log(data)
    const { customerId, partNumber, partRev, partDescription } = data;

    const { filename, mimeType } = fileInfo;
    // const requestBody = {
    //   mimeType,
    //   name: filename,
    //   parents: [ folderId ],
    //   // customerId,
    //   // partNumber,
    //   // partRev,
    //   // partDescription       //maybe this should be left out???
    // };

    const media = {
      body: fileStream,
    };

    //google auth setup
    const credentials = {
      private_key: process.env.SA_privateKey.replace(/\\n/g, '\n'),
      client_email: process.env.SA_clientEmail
    };
    const auth = new GoogleAuth({ 
      credentials, 
      scopes: 'https://www.googleapis.com/auth/drive'
    })

    const service = google.drive({
      version: 'v3',
      auth,
    })


    //check for customer folder
    const custFolder = await service.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${customerId}' and parents='${folderId}'`     //this if for looking for the customer folder
    })

    console.log(custFolder.data.files);


    let newFolder;
    if (custFolder.data.files.length === 0){
      newFolder = await _createFolder(customerId, folderId);
      console.log(newFolder.data)
    }

    const partParentFolder = custFolder.data.files[0]?.id || newFolder.data.id;



    //check for part folder
    const partFolder = await service.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${partNumber}-${partRev}' and parents='${partParentFolder}'`     //this if for looking for the part folder
    })

    console.log(partFolder.data.files);

    let newPartFolder;
    if (partFolder.data.files.length === 0){
      const pfName = `${partNumber}-${partRev}`;
      newPartFolder = await _createFolder(pfName, partParentFolder);
      console.log(newPartFolder.data)
    }

    const fileParentFolder = partFolder.data.files[0]?.id || newPartFolder.data.id;



    async function _createFolder(name, parentFolder){
      const body = {
            mimeType: 'application/vnd.google-apps.folder',
            name: name,
            parents: [parentFolder],
          };
      const folder = await service.files.create({
            media,
            requestBody: body,
            fields: 'id',
            supportsAllDrives: true,
          })
          .catch((e) => bb.emit('error', e))

          return folder;
    }

    



    // //check if customer folder is needed
    // if (custFolder.data.files.length === 0){
    //   console.log('--------------customer folder doesnt exist')
    //   const body = {
    //     mimeType: 'application/vnd.google-apps.folder',
    //     name: customerId,
    //     parents: [folderId],
    //   };

    //   //create folder
    //   await service.files.create({
    //     media,
    //     requestBody: body,
    //     fields: 'id',
    //     supportsAllDrives: true,
    //   })
    //   .catch((e) => bb.emit('error', e))
    // }
    


    // //check for files at drive location
    // try {
    //   const files = await service.files.list({
    //     // fileId: fileId,
    //     // fields: 'parents'
    //   })
    //   console.log('==============');
    //   console.log(files);

      
    // } catch (error) {
    //   console.log(error);
    // }

    // console.log('===========')
    // console.log(files);

    //create file on google drive
    const requestBody = {
      mimeType,
      name: filename,
      parents: [ fileParentFolder ],
      // customerId,
      // partNumber,
      // partRev,
      // partDescription       //maybe this should be left out???
    };
    service.files.create({
      media,
      requestBody,
      fields: 'id',
      supportsAllDrives: true,
      // addProperties: {
      //   customerId,
      //   partNumber,
      //   partRev,
      // }
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


  bb.on('close', () => res.sendStatus(201));

};