// APP FILE - this is a test to set 
const express = require('express');
const mongoose = require('mongoose');
const busboy = require('busboy');
const { drive_v3, google, clouddebugger_v2 } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
require('dotenv').config();

const app = express();
const PORT = 3000;

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
app.post('/delete', remove);
app.post('/deleteAll', removeAll);

// dump all other requests
app.all('*', (_req, res) => res.sendStatus(404));


///////////////
// FUNCTIONS //
///////////////

//Delete ALL files
async function removeAll(req, res){
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
    q: `parents='0AG-3k0Os7-2KUk9PVA'`,         //this is the folder where all google drive files go when they are deleted from the web browser
    fields: 'files(id,name, trashed, parents)'
  });
  // console.log(files.data.files)

  if (!files.data.files.length)   { return res.status(400).send('No files found ') }
  // console.log(files.data.files.length)

  async function _helper(id){       //should add some type of error handling here
    const result = await service.files.delete({fileId: `${id}`});
    // console.log(result.status);
    return result.status;
  }

  const promises = [];
  for (f of files.data.files){
    promises.push( _helper(f.id) );
  }

  await Promise.all(promises);
  console.log(promises.length)

  res.sendStatus(200)
  res.status(200).send(`${promises.length} files deleted`)

}

//Delete files
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
    q: `parents='0AG-3k0Os7-2KUk9PVA'`,
    fields: 'files(id,name, trashed, parents)'
  });

  const result = await service.files.delete({fileId: `${files.data.files[0].id}`});
  console.log(result.status);

  res.sendStatus(200)

}

//Used to find all files under this folder
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
    q: 'trashed=false',
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
    // q: `parents='103MNr84L_AItWpEcTRq87xcmFE_Tj90E'`,   //c_id_2 folder,
    // q: `parents='1sOgCx15ud-ldYPkqqrVDfTyr7djoR7c1'`,   //1234567890-b folder
    // q: 'test=\'a test\'',
    fields: 'files(id, name, trashed, parents)'
    // fields: 'files(id, name, trashed, parents, test)'

  });
  console.log(files.data.files)
  console.log(files.data.files.length)
  // console.log(files);

  

  res.sendStatus(200)
}

//First route to test app
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
  // const folderId = '1f7l0TJ_Pfm9YO2tfcyN3N1J6I7aaUawX'      //the root shared folder, probably should be pulled from ENV file
  const folderId = process.env.ROOT_FOLDER_ID;

  if (!folderId)   { res.sendStatus(400) };


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
      q: `mimeType='application/vnd.google-apps.folder' and name='${customerId}' and parents='${folderId}'`
    })
    // console.log(custFolder.data.files);

    let newFolder;
    if (custFolder.data.files.length === 0){
      newFolder = await _createFolder(customerId, folderId);
      // console.log(newFolder.data)
    }

    //set id of of parent folder either the found folder or the newly created folder
    const partParentFolder = custFolder.data.files[0]?.id || newFolder.data.id;



    //check for part folder
    const partFolder = await service.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${partNumber}-${partRev}' and parents='${partParentFolder}'`     //this if for looking for the part folder
    })
    // console.log(partFolder.data.files);

    let newPartFolder;
    if (partFolder.data.files.length === 0){
      const pfName = `${partNumber}-${partRev}`;
      newPartFolder = await _createFolder(pfName, partParentFolder);
      // console.log(newPartFolder.data)
    }

    // set id of part number folder from either the found folder or newly created folder
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


    //create file on google drive
    const requestBody = {
      mimeType,
      name: filename,
      parents: [ fileParentFolder ],
    };

    service.files.create({
      media,
      requestBody,
      fields: 'id',
      supportsAllDrives: true,
      appProperties: {            //this should be appProperties NOT addProperties
        // customerId,
        // partNumber,
        // partRev,
        "test": 'a test'
      }
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