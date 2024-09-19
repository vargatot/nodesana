const express = require('express');
const cors = require('cors');
const path = require('path');
const { logWorkspaceList, submitDataToSheet, getRowsByTaskID } = require('./smartsheet');
const { getTaskDetails, getUserDetails, getCustomFieldsForProject, updateCustomField, storiesApiInstance } = require('./asana');
const app = express();
const port = process.env.PORT || 8000;
let submittedData = {};

// Parse JSON bodies
app.use(express.json());

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
  console.log(req.query);

  // Get task details from Asana
  let taskDetails;
  try {
    taskDetails = await getTaskDetails(task);
    console.log(taskDetails);
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
              id: 'Bondár Balázs',
              label: 'Bondár Balázs',
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
              id: 'AEPD-619',
              label: 'AEPD-619',
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
          is_required: false,
          options: [
            {
              id: "Alapértelmezett",
              label: "Alapértelmezett",
            },
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

app.get('/search/typeahead', (req, res) => {
  console.log('Typeahead happened!');
  res.json(typeahead_response);
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
  
  if (req.body.data) {
    try {
      await submitQueue.add(async () => {
        const parsedData = JSON.parse(req.body.data);
        submittedData = parsedData.values || {};

        // Regular expression to match a valid number (optional decimal point)
        const validNumberRegex = /^\d+(\.\d+)?$/;

        // Validate the distance field
        const distance = submittedData.Distance_SL;
        /* 
        if(!validNumberRegex.test(distance)){
          distance=0;
          submittedData.Distance_SL=0;
        }*/
        if (!validNumberRegex.test(distance) || parseFloat(distance) < 0 || parseFloat(distance) > 10000) {
          return res.status(400).send('Hibás távolság érték. A távolság nem lehet negatív, és maximum 10,000 lehet, illetve csak érvényes szám lehet.');
        }

        // Validate the travel time field
       /* 
        const travelTime = submittedData.Distance_Time_SL;
        if(!validNumberRegex.test(travelTime)){
          travelTime=0;
          submittedData.Distance_Time_SL=0;
        }*/
        if (!validNumberRegex.test(travelTime) || parseFloat(travelTime) < 0 || parseFloat(travelTime) > 24) {
          return res.status(400).send('Hibás útidő érték. Az útidő nem lehet negatív, és maximum 24 óra lehet, illetve csak érvényes szám lehet.');
        }

        // Extract task ID from the request body
        const taskId = req.body.task || parsedData.task || parsedData.AsanaTaskName_SL;

        // Get task details to fetch the task ID
        const taskDetails = await getTaskDetails(taskId);
        submittedData.AsanaTaskID_SL = taskDetails.taskId;

        // Log the sheet list to console
        logWorkspaceList();
        // Submit the data to Smartsheet
        await submitDataToSheet(8740124331665284, 'Munkaidő és kiszállás', 'Projektköltségek', submittedData);

        // Read back the rows from the Smartsheet and calculate the total distance
        const { filteredRows, totalKilometers } = await getRowsByTaskID(8740124331665284, 'Munkaidő és kiszállás', 'Projektköltségek', taskDetails.taskId);
        const commentBody = {
          data: {
            text: `Beírt kilométer: ${submittedData.Distance_SL}, összesen: ${totalKilometers}`
          }
        };
        await updateCustomField(taskDetails.taskId, taskDetails.projectId, totalKilometers);

        // Send the response including the total kilometers
        res.json({ attachment_response, totalKilometers });
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
