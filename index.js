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

// Enable CORS
app.use(cors({
  origin: 'https://app.asana.com',
}));

// Run before every API request
app.use((req, res, next) => {
  const expirationDate = req.query.expires_at || req.body.expires_at;
  const currentDate = new Date();

  if (currentDate.getTime() > new Date(expirationDate).getTime()) {
    console.log('Request expired.');
    return;
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
console.log('Custom field kiírás :',customFields);
  // Get current date
  const currentDate = formatDate(new Date());

  // Form response with initial values
  const form_response = {
    template: 'form_metadata_v0',
    metadata: {
      title: "Kilométer költség",
      on_submit_callback: 'https://app-components-example-app.onrender.com/form/submit',
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
              id: 'banyai.gabor@promir.hu',
              label: 'Bányai Gábor',
            },
            {
              id: 'bozoki.robert@promir.hu',
              label: 'Bozóki Róbert',
            },
            {
              id: 'bondar.balazs@promir.hu',
              label: 'Bondár Balázs',
            },
            {
              id: 'deak.adam@promir.hu',
              label: 'Deák Ádám',
            },
            {
              id: 'keller.zoltan@promir.hu',
              label: 'Keller Zoltán',
            },
            {
              id: 'klein.antal@promir.hu',
              label: 'Klein Antal',
            },
            {
              id: 'mendei.arpad@promir.hu',
              label: 'Mendei Árpád',
            },
            {
              id: 'palecska.gabor@promir.hu',
              label: 'Palecska Gábor',
            },
            {
              id: 'sinka.balazs@promir.hu',
              label: 'Sinka Balázs',
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
          value: userDetails.email, // Set default value to the current user
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
              id: 'AEPD-490',
              label: 'AELE-490',
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
          is_required: false,
          placeholder: 'Dátum',
          value: currentDate, // Set initial value to current date
        },
        {
          name: "Kilométer",
          type: "single_line_text",
          id: "Distance_SL",
          is_required: false,
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
      on_change_callback: 'https://app-components-example-app.onrender.com/form/onchange',
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

app.post('/form/submit', async (req, res) => { // Asynchronous function
  console.log('Modal Form submitted!');
  
  if (req.body.data) {
    try {
      const parsedData = JSON.parse(req.body.data);
      submittedData = parsedData.values || {};

      // Extract task ID from the request body
      const taskId = req.body.task || parsedData.task || parsedData.AsanaTaskName_SL;

      // Get task details to fetch the task ID
      const taskDetails = await getTaskDetails(taskId);
      submittedData.AsanaTaskID_SL = taskDetails.taskId;

      // Log the sheet list to console
      logWorkspaceList();

      // Submit the data to Smartsheet
      await submitDataToSheet(3802479470110596, 'ASANA Proba', 'Teszt01', submittedData);

      // Read back the rows from the Smartsheet and calculate the total distance
      const { filteredRows, totalKilometers } = await getRowsByTaskID(3802479470110596, 'ASANA Proba', 'Teszt01', taskDetails.taskId);
      const commentBody = {
        data: {
          text: `Beírt kilométer: ${submittedData.Distance_SL}, összesen: ${totalKilometers}`
        }
      };
      await storiesApiInstance.createStoryForTask(commentBody, taskDetails.taskId);
      
      // Update custom field value for the task
      await updateCustomField(taskDetails.taskId, taskDetails.projectId, totalKilometers);

      // Send the response including the total kilometers
      res.json({ attachment_response, totalKilometers });
    } catch (error) {
      console.log('Error parsing data:', error);
      res.status(500).send('Error submitting data to Smartsheet');
      return;
    }
  }else{
 
  res.json(attachment_response);
}
});

const attachment_response = {
  resource_name: "I'm an Attachment",
  resource_url: 'https://app-components-example-app.onrender.com',
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
