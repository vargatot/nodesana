const Asana = require('asana');

// Initialize Asana client
let client = Asana.ApiClient.instance;
let token = client.authentications['token'];
token.accessToken = process.env.ASANA_ACCESS_TOKEN; // Ensure the token is set correctly

let storiesApiInstance = new Asana.StoriesApi();
let tasksApiInstance = new Asana.TasksApi();
let projectsApiInstance = new Asana.ProjectsApi();
let usersApiInstance = new Asana.UsersApi();
let customFieldSettingsApiInstance = new Asana.CustomFieldSettingsApi();
let customFieldsApiInstance = new Asana.CustomFieldsApi();

// Function to get task details from Asana
async function getTaskDetails(taskId) {
  let firstTaskID = taskId;
  let opts = {
    'opt_fields': "name,projects,parent"
  };

  let attempts = 0;
  let maxAttempts = 5;
  let task;
  let project = null;
  let projectName = '';
  let projectId = '';
  
  try {
    while (attempts < maxAttempts) {
      const result = await tasksApiInstance.getTask(taskId, opts);
      task = result.data;
      console.log("Attempt:", attempts);
      if (task.projects && task.projects.length > 0) {
        project = task.projects[0];
        break;
      }

      if (task.parent) {
        taskId = task.parent.gid; // Get the parent task id and continue the loop
      } else {
        break; // No parent, no project, end the loop
      }

      attempts++;
    }

    if (project) {
      const projectResult = await projectsApiInstance.getProject(project.gid);
      projectName = projectResult.data.name;
      projectId = project.gid;
    }

    // Split project name into project number and project name
    const [projectNumber, projectTaskName] = projectName.includes(' - ') ? projectName.split(' - ') : [projectName, ''];

    return {
      projectName: projectTaskName || projectName, // This is the actual project name (after splitting)
      projectId: projectId,
      projectNumber: projectNumber, // This is the project number (before the split)
      taskName: task.name,
      taskId: firstTaskID // Include the taskId here
    };
  } catch (error) {
    console.error('Error fetching task details from Asana:', error.message);
    throw error;
  }
}


// Function to get user details from Asana
async function getUserDetails(userId) {
  let opts = { 
    'opt_fields': "email,name"
  };

  try {
    const result = await usersApiInstance.getUser(userId, opts);
    const user = result.data;
   
    return {
      email: user.email,
      name: user.name,
    };
  } catch (error) {
    console.error('Error fetching user details from Asana:', error.message);
    throw error;
  }
}

// Function to fetch custom fields for a project
async function getCustomFieldsForProject(projectId) {
  let opts = { 
    'limit': 50, 
    'opt_fields': "custom_field,custom_field.name,custom_field.type"
  };
  console.log(projectId);
  console.log("-------------1");
  try {
    const result = await customFieldSettingsApiInstance.getCustomFieldSettingsForProject(projectId, opts);


  
    console.log("-------------2");
    return result.data;
  } catch (error) {
    console.error('Error fetching custom fields for project:', error.message);
    throw error;
  }
}

// Function to get the custom field ID by name
async function getCustomFieldIdByName(projectId, fieldName) {
  try {
    console.log("-------------3");
    const customFields = await getCustomFieldsForProject(projectId);
    const customField = customFields.find(field => field.custom_field.name === fieldName);
    return customField ? customField.custom_field.gid : null;
  } catch (error) {
    console.error('Error fetching custom field ID:', error.message);
    throw error;
  }
}

// Function to update the custom field value
async function updateCustomField(taskId, projectId, totalKilometers) {
  try {
    // Get the custom field ID by name

    const customFieldGid = await getCustomFieldIdByName(projectId, 'Kilométer');
    console.log("-------------4");
    console.log([customFieldGid]);
    let body = {"data":{"custom_fields":{[customFieldGid] : totalKilometers.toString()}}}; // Object | The task to update.
    console.log("-----");
    console.log(body);
    let opts = {};
    tasksApiInstance.updateTask(body, taskId, opts).then((result) => {
        console.log('API called successfully.');
      }, (error) => {
          console.error(error.response.body);
      });
  } catch (error) {
    console.error('Error updating custom field:', error.message);
    throw error;
  }
}



// Új Asana task létrehozása mezőnevekkel
async function createAsanaTask({ assignee, name, dueDate, projectId, customFields }) {
  try {
    // Lekérjük a projekthez tartozó custom field ID-ket
    const projectCustomFields = await getCustomFieldsForProject(projectId);
    console.log('Custom field nevek a projektben:');
    for (const fieldSetting of projectCustomFields) {
      console.log(`${fieldSetting.custom_field.name} (${fieldSetting.custom_field.resource_subtype})`);
    }

    const customFieldIdMap = {};
    for (const fieldSetting of projectCustomFields) {
      const fieldName = fieldSetting.custom_field.name;
      customFieldIdMap[fieldName] = fieldSetting.custom_field.gid;
    }

    // Felépítjük a custom_fields objektumot ID-k alapján
    const customFieldsPayload = {};
    for (const [fieldName, value] of Object.entries(customFields)) {
      const fieldId = customFieldIdMap[fieldName];
      if (fieldId) {
        customFieldsPayload[fieldId] = value;
      } else {
        console.warn(`Custom field '${fieldName}' nem található a projektben.`);
      }
    }

    // Dátum ellenőrzés és átalakítás YYYY-MM-DD formátumra
    let formattedDueDate = null;

    if (dueDate instanceof Date && !isNaN(dueDate)) {
      // valódi Date objektum
      formattedDueDate = formatDateToYMD(dueDate);
    } else if (typeof dueDate === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        // tiszta YYYY-MM-DD
        formattedDueDate = dueDate;
      } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(dueDate)) {
        // ISO-formátumú dátumstring
        const parsed = new Date(dueDate);
        if (!isNaN(parsed)) {
          formattedDueDate = formatDateToYMD(parsed);
        }
      }
    }

    const isValidDate = Boolean(formattedDueDate);
    console.log('dueDate:', dueDate);
    console.log('Formatted dueDate:', formattedDueDate);
    console.log('Valid Date:', isValidDate);

    const taskData = {
      data: {
        name: name,
        assignee: assignee,
        ...(isValidDate ? { due_on: formattedDueDate } : {}), // csak ha valid a dátum
        projects: [projectId],
        custom_fields: customFieldsPayload
      }
    };

    const result = await tasksApiInstance.createTask(taskData);
    return result.data.gid;
  } catch (error) {
    console.error('Hiba az Asana task létrehozásakor:', error.message);
    throw error;
  }
}

function formatDateToYMD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
async function updateRendszamField(taskId, rendszamNev) {
  try {
    // Enum értékek GID-jei rendszámokhoz (ne bővüljön dinamikusan, fix GID-ek!)
    const rendszamValueMap = {
      "RMZ-496": "1201830409216206",
      "PSG-690": "1201830409218223",
      "AEDP-619": "1210109192980863",
      "AEEC-156": "1210109192980864",
      "AEDH-132": "1210109192980865",
      "AELE-490": "1210109192980866",
      "AIHH-238": "1210109192980867",
      "AIHH-239": "1210109192980868",
      "MBN-927": "1210109192980869",
      "MTF-396": "1210109192980870",
      "NEK-593": "1210109192980871",
      "NYP-188": "1210109192980872",
      "PWF-261": "1210109192980873",
      "RSJ-356": "1210109192980874",
      "SDS-109": "1210109192980875",
      "SKV-930": "1210109192980876",
      "TFG-467": "1210109192980877",
      "TGK-267": "1210109192980878",
      "LWF-099": "1210109192980879",
      "MVU-936": "1210109192980880",
      "GÉPKOCSI": "1210109192980881",
      "UTAS": "1210109192980882"
    };

    // Enum típusú custom field GID-je (Rendszám mező)
    const rendszamFieldGid = "1201830409216170"; // ezt cseréld ki a valódi GID-re, ha más

    const rendszamEnumGid = rendszamValueMap[rendszamNev];
    if (!rendszamEnumGid) {
      throw new Error(`Ismeretlen rendszám: ${rendszamNev}`);
    }

    const body = {
      data: {
        custom_fields: {
          [rendszamFieldGid]: rendszamEnumGid
        }
      }
    };

    const opts = {};
    await tasksApiInstance.updateTask(body, taskId, opts);
    console.log(`Rendszám frissítve: ${rendszamNev} (${rendszamEnumGid})`);
  } catch (error) {
    console.error('Hiba a Rendszám mező frissítésekor:', error.message);
    throw error;
  }
}
async function updateSzerepkorField(taskId, szerepkorNev) {
  try {
    // Enum value GID-ek szerepkörökhöz (ne bővüljön dinamikusan, fix GID-ek!)
    const szerepkorValueMap = {
      "PM": "1201389865826248",
      "CRM": "1201575450481275",
      "Beszerzés": "1201389865835646",
      "Tervezés": "1201389865836701",
      "Programozás": "1201389865836736",
      "Szerelés": "1201389865838878"
    };

    // Enum típusú custom field GID-je (Szerepkör mező)
    const szerepkorFieldGid = "1201389865824185";

    const szerepkorEnumGid = szerepkorValueMap[szerepkorNev];
    if (!szerepkorEnumGid) {
      throw new Error(`Ismeretlen szerepkör: ${szerepkorNev}`);
    }

    const body = {
      data: {
        custom_fields: {
          [szerepkorFieldGid]: szerepkorEnumGid
        }
      }
    };

    const opts = {};

    //tasksApiInstance.updateTask(body, taskId, opts).then((result) => {
    await tasksApiInstance.updateTask(body, taskId, opts);
    console.log(`Szerepkör frissítve: ${szerepkorNev} (${szerepkorEnumGid})`);
  } catch (error) {
    console.error('Hiba a Szerepkör mező frissítésekor:', error.message);
    throw error;
  }
}
/*
async function updateKiszallasDatumaField(taskId, datum) {
  try {
    // "Kiszállás Dátuma" mező GID-je – ezt cseréld ki a valódi értékre, ha más
    const kiszallasDatumaFieldGid = "1210107930767425"; // ← Példa GID, cseréld ha szükséges

    // ISO dátum formátumra konvertálás, ha nem úgy jött
    const isoDatum = new Date(datum).toISOString().split('T')[0]; // csak 'YYYY-MM-DD' kell
    console.log(`isoDatum datum: ${isoDatum} (${datum})`);
    const body = {
      data: {
        custom_fields: {
          [kiszallasDatumaFieldGid]: isoDatum
        }
      }
    };

    const opts = {};

    await tasksApiInstance.updateTask(body, taskId, opts);
    console.log(`Kiszállás dátuma frissítve: ${isoDatum}`);
  } catch (error) {
    console.error('Hiba a Kiszállás Dátuma mező frissítésekor:', error.message);
    throw error;
  }
}*/


module.exports = {
  getTaskDetails,
  getUserDetails,
  getCustomFieldsForProject,
  updateCustomField,
  getCustomFieldIdByName,
  createAsanaTask,
  updateSzerepkorField,
  updateRendszamField,
 // updateKiszallasDatumaField,
  storiesApiInstance
};