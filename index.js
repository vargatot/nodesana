const express = require('express');
const cors = require('cors');
const path = require('path');
const { submitDataToSheet, getRowsByTaskID } = require('./smartsheet');
const { getTaskDetails, getUserDetails, getCustomFieldsForProject, updateCustomField, storiesApiInstance,createAsanaTask,updateSzerepkorField,updateRendszamField } = require('./asana');
const app = express();
const port = process.env.PORT || 8000;
let submittedData = {};
const bodyParser = require('body-parser');
// Parse JSON bodies
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Enable CORS for specific origin
app.use(cors({
  origin: 'https://app.asana.com',
}));

// Run before every API request
app.use((req, res, next) => {
  const expirationDate = req.query.expires_at || req.body.expires_at;
  const currentDate = new Date();

  if (currentDate.getTime() > new Date(expirationDate).getTime()) {
    console.log('Request expired.');
    return res.status(403).send('Request expired.');
  }

  next();
});
const workerEmailMapping = {
  'Bányai Gábor': 'banyai.gabor@promir.hu', // Replace with the actual email
  'Bozóki Róbert': 'bozoki.robert@promir.hu', // Replace with the actual email
  'Deák Ádám': 'deak.adam@promir.hu', // Replace with the actual email
  'Keller Zoltán': 'keller.zoltan@promir.hu', // Replace with the actual email
  'Klein Antal': 'klein.antal@promir.hu', // Replace with the actual email
  'Séllei Ádám': 'sellei.adam@promir.hu', // Replace with the actual email
  'Mendei Árpád': 'mendei.arpad@promir.hu', // Replace with the actual email
  'Palecska Gábor': 'palecska.gabor@promir.hu', // Replace with the actual email
  'Sinka Balázs': 'sinka.balazs@promir.hu', // Replace with the actual email
  'Szancsik Ferenc': 'szancsik.ferenc@promir.hu', // Replace with the actual email
  'Szepesi Róbert': 'szepesi.robert@promir.hu', // Replace with the actual email
  'Szöllősi Sándor': 'szollosi.sandor@promir.hu', // Replace with the actual email
  'Tóth Szabolcs': 'toth.szabolcs@promir.hu', // Replace with the actual email
  'Varga-Tóth István': 'vargatot@promir.hu', // Replace with the actual email
  'Varga-Tóth Ádám': 'vtadam@promir.hu', // Replace with the actual email
  // Add more workers here as needed
};
const KulsosWorkerEmailToNameMapping = {
  'banyai.gabor@promir.hu': 'BG Kft.',
  'sharaszti@elektrofox.hu': 'Elektrofox Kft.',
  'fejes.delalfoldszolar@gmail.com': 'Dél-Alföld Szolár Kft.',
  'lesliemiller.hu@gmail.com': 'Molnár László EV',
  's.lajoslorant@gmail.com': 'Schmidt Lajos Lóránt EV',
  'angyo.no1@gmail.com': 'Garai János EV',
  'zsolt.deak@nexuselectro.hu': 'Nexus Electro Kft.',
  'lantos.villszer@gmail.com': 'Lantos Tamás EV',
  'sipos.zoltan@electricart.hu': 'TOSILA BT',
  // Add more mappings as needed...
};


// Function to format date to YYYY-MM-DD
function formatDate(date) {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) 
    month = '0' + month;
  if (day.length < 2) 
    day = '0' + day;

  return [year, month, day].join('-');
}

// Client endpoint for auth
app.get('/auth', (req, res) => {
  console.log('Auth happened!');
  res.sendFile(path.join(__dirname, '/auth.html'));
});

// Promise Queue implementation
class PromiseQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    console.log("Process in queue!!!!BAZDMÖG")
    const { fn, resolve, reject } = this.queue.shift();

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.isProcessing = false;
      this.process(); // Tovább a következő feladatra a sorban
    }
  }
}

// Initialize the queue
const submitQueue = new PromiseQueue();

// API endpoints
app.get('/form/metadata', async (req, res) => {
  console.log('Modal Form happened!');
  // Extract query parameters
  const { user, task } = req.query;
 

  // Get task details from Asana
  let taskDetails;
  try {
    taskDetails = await getTaskDetails(task);
    
  } catch (error) {
    return res.status(500).send('Error fetching task details from Asana');
  }

  // Get user details from Asana
  let userDetails;
  try {
    userDetails = await getUserDetails(user);
  } catch (error) {
    return res.status(500).send('Error fetching user details from Asana');
  }

  // Fetch custom fields for the project
  let customFields;
  try {
    customFields = await getCustomFieldsForProject(taskDetails.projectId);
  } catch (error) {
    return res.status(500).send('Error fetching custom fields for project');
  }

  // Get current date
  const currentDate = formatDate(new Date());

  // Form response with initial values
  const form_response = {
    template: 'form_metadata_v0',
    metadata: {
      title: "Kilométer költség",
      on_submit_callback: 'https://nodesana.azurewebsites.net/form/submit',
      fields: [
        {
          name: "Projektszám",
          type: "single_line_text",
          id: "ProjectNumber_SL",
          is_required: false,
          placeholder: "[full width]",
          width: "full",
          value: taskDetails.projectNumber, // Set initial value from Asana
        },
        {
          name: "Projektnév",
          type: "single_line_text",
          id: "ProjectName_SL",
          is_required: false,
          placeholder: "[full width]",
          width: "full",
          value: taskDetails.projectName, // Set initial value from Asana
        },
        {
          name: "ASANA TaskName",
          type: "single_line_text",
          id: "AsanaTaskName_SL",
          is_required: false,
          placeholder: "[full width]",
          width: "full",
          value: taskDetails.taskName, // Set initial value from Asana
        },
        
        {
          name: 'Munkavégző',
          type: 'dropdown',
          id: 'Worker_dropdown',
          is_required: true,
          options: [
            {
              id: 'Bányai Gábor',
              label: 'Bányai Gábor',
            },
            {
              id: 'Bozóki Róbert',
              label: 'Bozóki Róbert',
            },

            {
              id: 'Deák Ádám',
              label: 'Deák Ádám',
            },
            {
              id: 'Keller Zoltán',
              label: 'Keller Zoltán',
            },
            {
              id: 'Klein Antal',
              label: 'Klein Antal',
            },
            {
              id: 'Mendei Árpád',
              label: 'Mendei Árpád',
            },
            {
              id: 'Séllei Ádám',
              label: 'Séllei Ádám',
            },
            {
              id: 'Palecska Gábor',
              label: 'Palecska Gábor',
            },
            {
              id: 'Sinka Balázs',
              label: 'Sinka Balázs',
            },
            {
              id: 'Szancsik Ferenc',
              label: 'Szancsik Ferenc',
            },
            {
              id: 'Szepesi Róbert',
              label: 'Szepesi Róbert',
            },
            {
              id: 'Szöllősi Sándor',
              label: 'Szöllősi Sándor',
            },
            {
              id: 'Tóth Szabolcs',
              label: 'Tóth Szabolcs',
            },
            {
              id: 'Varga-Tóth István',
              label: 'Varga-Tóth István',
            },
            {
              id: 'Varga-Tóth Ádám',
              label: 'Varga-Tóth Ádám',
            },
          ],
          width: 'half',
          value: userDetails.name, // Set default value to the current user
        },
        {
          name: 'Rendszám',
          type: 'dropdown',
          id: 'PlateNumber_dropdown',
          is_required: true,
          options: [
            {
              id: 'AEDP-619',
              label: 'AEDP-619',
            },
            {
              id: 'AEEC-156',
              label: 'AEEC-156',
            },
            {
              id: 'AEDH-132',
              label: 'AEDH-132',
            },
            {
              id: 'AELE-490',
              label: 'AELE-490',
            },
            {
              id: 'AIHH-238',
              label: 'AIHH-238',
            },
            {
              id: 'AIHH-239',
              label: 'AIHH-239',
            },
            {
              id: 'MBN-927',
              label: 'MBN-927',
            },
            {
              id: 'MTF-396',
              label: 'MTF-396',
            },
            {
              id: 'NEK-593',
              label: 'NEK-593',
            },
            {
              id: 'NYP-188',
              label: 'NYP-188',
            },
            {
              id: 'PWF-261',
              label: 'PWF-261',
            },
            {
              id: 'RMZ-496',
              label: 'RMZ-496',
            },
            {
              id: 'RSJ-356',
              label: 'RSJ-356',
            },
            {
              id: 'SDS-109',
              label: 'SDS-109',
            },
            {
              id: 'SKV-930',
              label: 'SKV-930',
            },
            {
              id: 'TFG-467',
              label: 'TFG-467',
            },
            {
              id: 'TGK-267',
              label: 'TGK-267',
            },
            {
              id: 'LWF-099',
              label: 'LWF-099',
            },
            {
              id: 'MVU-936',
              label: 'MVU-936',
            },
            {
              id: 'PSG-689',
              label: 'PSG-689',
            },
            {
              id: 'PSG-690',
              label: 'PSG-690',
            },
            {
              id: 'GÉPKOCSI',
              label: 'GÉPKOCSI',
            },
            {
              id: 'UTAS',
              label: 'UTAS',
            },
          ],
          width: 'half',
        },
        {
          name: 'Munkavégzés Dátuma',
          type: 'date',
          id: 'date',
          is_required: true,
          placeholder: 'Dátum',
          value: currentDate, // Set initial value to current date
        },
        {
          name: "Távolság (km)",
          type: "single_line_text",
          id: "Distance_SL",
          is_required: true,
          placeholder: "0",
          width: "half",
          value: "0",
        },
        {
          name: "Útidő (óra) - [Nem kötelező]",
          type: "single_line_text",
          id: "Distance_Time_SL",
          is_required: true,
          placeholder: "0",
          width: "half",
          value: "0",
        },
        
        {
          name: "Szerepkör",
          type: "radio_button",
          id: "radio_button",
          is_required: true,
          options: [
            /*{
              id: "Alapértelmezett",
              label: "Alapértelmezett",
            },*/
            {
              id: "Programozás",
              label: "Programozás",
            },
            {
              id: "PM",
              label: "PM",
            },
            {
              id: "Tervezés",
              label: "Tervezés",
            },
            {
              id: "Szerelés",
              label: "Szerelés",
            },
            {
              id: "Beszerzés",
              label: "Beszerzés",
            },
            {
              id: "CRM",
              label: "CRM",
            },
          ],
        },
      ],
      on_change_callback: 'https://nodesana.azurewebsites.net/form/onchange',
    },
  };

  res.json(form_response);
});

app.get('/kulsosmunkalap/metadata', async (req, res) => {
  console.log('Összesített alvállalkozói munkalap Form happened!');
  // Extract query parameters
  const { user, task } = req.query;
 

  // Get task details from Asana
  let taskDetails;
  try {
    taskDetails = await getTaskDetails(task);
    
  } catch (error) {
    return res.status(500).send('Error fetching task details from Asana');
  }

  // Get user details from Asana
  let userDetails;
  try {
    userDetails = await getUserDetails(user);
  } catch (error) {
    return res.status(500).send('Error fetching user details from Asana');
  }

  // Fetch custom fields for the project

  // Get current date
  const currentDate = formatDate(new Date());

  // Form response with initial values
  const form_response = {
    template: 'form_metadata_v0',
    metadata: {
      title: "Új munkalap létrehozása",
      on_submit_callback: 'https://nodesana.azurewebsites.net/kulsosmunkalap/submit',
      fields: [
        {
          name: "Projektszám",
          type: "single_line_text",
          id: "ProjectNumber_SL",
          is_required: false,
          placeholder: "Projektszám megadása kötelező!",
          width: "full",
          value: taskDetails.projectNumber, // Set initial value from Asana
        },
        {
          name: 'Munkavégző',
          type: 'dropdown',
          id: 'Worker_dropdown',
          is_required: true,
          options: [
            {
              id: 'sharaszti@elektrofox.hu',
              label: 'Elektrofox Kft.',
            },
            {
              id: 'fejes.delalfoldszolar@gmail.com',
              label: 'Dél-Alföld Szolár Kft.',
            },
            {
              id: 'lesliemiller.hu@gmail.com',
              label: 'Molnár László EV',
            },
            {
              id: 's.lajoslorant@gmail.com',
              label: 'Schmidt Lajos Lóránt EV',
            },
            {
              id: 'angyo.no1@gmail.com',
              label: 'Garai János EV',
            },
            {
              id: 'zsolt.deak@nexuselectro.hu',
              label: 'Nexus Electro Kft.',
            },
            {
              id: 'lantos.villszer@gmail.com',
              label: 'Lantos Tamás EV',
            },
            {
              id: 'sipos.zoltan@electricart.hu',
              label: 'TOSILA BT',
            },
          ],
          width: 'half',
          value: '', // Set default value to the current user
        },
        {
          name: 'Projektvezető',
          type: 'dropdown',
          id: 'PV_dropdown',
          is_required: true,
          options: [
            {
              id: 'bozoki.robert@promir.hu',
              label: 'Bozóki Róbert',
            },

            {
              id: 'deak.adam@promir.hu',
              label: 'Deák Ádám',
            },
            {
              id: 'sellei.adam@promir.hu',
              label: 'Séllei Ádám',
            },
            {
              id: 'palecska.gabor@promir.hu',
              label: 'Palecska Gábor',
            },

            {
              id: 'szancsik.ferenc@promir.hu',
              label: 'Szancsik Ferenc',
            },
            {
              id: 'szepesi.robert@promir.hu',
              label: 'Szepesi Róbert',
            },
            {
              id: 'szollosi.sandor@promir.hu',
              label: 'Szöllősi Sándor',
            },
            {
              id: 'vargatot@promir.hu',
              label: 'Varga-Tóth István',
            },
            {
              id: 'vtadam@promir.hu',
              label: 'Varga-Tóth Ádám',
            },
          ],
          width: 'half',
          value: userDetails.name, // Set default value to the current user
        },
        {
          name: 'Munkavégzés Dátuma',
          type: 'date',
          id: 'date',
          is_required: true,
          placeholder: 'Dátum',
          value: currentDate, // Set initial value to current date
        },
        {
          name: "Munkavégzés helyszíne",
          type: "single_line_text",
          id: "Working_Place_SL",
          is_required: false,
          placeholder: "",
          width: "full",
          
        },
        {
          type: 'multi_line_text',
          id: 'PV_Leiras_ML',
          name: 'Megjegyzés',
          value: '',
          is_required: false,
          placeholder: '...',
        },
        
      ],
      on_change_callback: 'https://nodesana.azurewebsites.net/kulsosmunkalap/onchange',
    },
  };

  res.json(form_response);
});

app.post('/form/onchange', (req, res) => {
  console.log('OnChange happened!');
  res.json(form_response);
});

app.post('/search/attach', (req, res) => {
  console.log('Attach happened!');
  res.json(attachment_response);
});


app.post('/form/submit', async (req, res) => {
  console.log('Modal Form submitted!');
  const workspaceId = '23166877939657';
  const asanaProjectId = '1210076978597830';

  if (req.body.data) {
    try {
      await submitQueue.add(async () => {
        const parsedData = JSON.parse(req.body.data);
        submittedData = parsedData.values || {};

        const validNumberRegex = /^\d+(\.\d+)?$/;

        // Validálás
        const distance = submittedData.Distance_SL;
        if (!validNumberRegex.test(distance) || parseFloat(distance) < 0 || parseFloat(distance) > 10000) {
          return res.status(400).send('Hibás távolság érték.');
        }

        const travelTime = submittedData.Distance_Time_SL;
        if (!validNumberRegex.test(travelTime) || parseFloat(travelTime) < 0 || parseFloat(travelTime) > 24) {
          return res.status(400).send('Hibás útidő érték.');
        }

        const taskId = req.body.task || parsedData.task || parsedData.AsanaTaskName_SL;
        const taskDetails = await getTaskDetails(taskId);
        submittedData.AsanaTaskID_SL = taskDetails.taskId;

        const workerName = submittedData.Worker_dropdown;
        const workerEmail = workerEmailMapping[workerName] || 'default.email@promir.hu';
        submittedData.UserID = workerEmail;

        submittedData.AsanaTaskLink = `https://app.asana.com/0/${taskDetails.projectId}/${taskDetails.taskId}`;

        await submitDataToSheet(8740124331665284, 'Munkaidő és kiszállás', 'Projektköltségek', submittedData);

        const { filteredRows, totalKilometers } = await getRowsByTaskID(
          8740124331665284, 'Munkaidő és kiszállás', 'Projektköltségek', taskDetails.taskId
        );
        await updateCustomField(taskDetails.taskId, taskDetails.projectId, totalKilometers);

        console.log('SUBMITTED DATA:', submittedData);

        // 🔹 Get custom field ID map for the project
        const customFieldIdMap = await getCustomFieldsForProject(asanaProjectId);

        // 🔹 Custom field values
        const customFields = {
          'Projektszám': taskDetails.projectNumber,
          'Projektnév': taskDetails.projectName,
          'Kilométer': parseFloat(submittedData.Distance_SL),
          'Beírt útidő (ó)': parseFloat(submittedData.Distance_Time_SL),
          'Kalkulált útidő (ó)': parseFloat(submittedData.Distance_SL) / 70,
          'Kiszállás Dátuma': submittedData.date
        };

        const customFieldsPayload = {};
        for (const [name, value] of Object.entries(customFields)) {
          const fieldId = customFieldIdMap[name];
          if (fieldId) {
            customFieldsPayload[fieldId] = value;
          } else {
            console.warn(`Custom field '${name}' nem található.`);
          }
        }

        try {
          const newTaskId = await createAsanaTask({
            name: workerName,
            dueDate: submittedData.date,
            projectId: asanaProjectId,
            customFields: customFieldsPayload
          });

          console.log('Új Asana task létrehozva:', newTaskId);
          await updateSzerepkorField(newTaskId, submittedData.radio_button);
          await updateRendszamField(newTaskId, submittedData.PlateNumber_dropdown);

        } catch (asanaError) {
          console.error('Nem sikerült új Asana taskot létrehozni:', asanaError.message);
        }

        res.json({ attachment_response, totalKilometers });
      });

    } catch (error) {
      console.log('Error parsing data:', error);
      res.status(500).send('Error submitting data to Smartsheet');
    }
  } else {
    res.json(attachment_response);
  }
});

app.post('/kulsosmunkalap/submit', async (req, res) => {
  console.log('Külsős munkalap Form submitted!');
  
  if (req.body.data) {
    try {
      await submitQueue.add(async () => {
      const parsedData = JSON.parse(req.body.data);
      submittedData = parsedData.values || {};

      // Extract task ID from the request body
      const taskId = req.body.task || parsedData.task || parsedData.AsanaTaskName_SL;

      // Get task details from Asana (project name and project number)
      const taskDetails = await getTaskDetails(taskId);

      submittedData.rowid='=JOIN(MunkalapID@row)';
      submittedData.ProjectName_SL = taskDetails.projectName;      // Add project name

      // Add both the worker name and email to submittedData
      submittedData.WorkerName = KulsosWorkerEmailToNameMapping[submittedData.Worker_dropdown] || 'Unknown Worker'; // Map email to worker name

      // Proceed to submit the data to Smartsheet
      await submitDataToSheet(8740124331665284, 'Munkaidő és kiszállás', 'Összesített alvállalkozói munkalap', submittedData);

        // Send the response
        res.json({ attachment_response });
      });
    } catch (error) {
      console.log('Error parsing data:', error);
      res.status(500).send('Error submitting data to Smartsheet');
      return;
    }
  } else {
    res.json(attachment_response);
  }
});


const attachment_response = {
  resource_name: "I'm an Attachment",
  resource_url: 'https://nodesana.azurewebsites.net',
};

const typeahead_response = {
  items: [
    {
      title: "I'm a title",
      subtitle: "I'm a subtitle",
      value: 'some_value',
      icon_url: 'https://placekitten.com/16/16',
    },
    {
      title: "I'm a title",
      subtitle: "I'm a subtitle",
      value: 'some_value',
      icon_url: 'https://placekitten.com/16/16',
    },
  ],
};

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
