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


    console.log(result.data);
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

    const taskData = {
      data: {
        name: name,
        assignee: assignee,
        due_on: dueDate,
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



module.exports = {
  getTaskDetails,
  getUserDetails,
  getCustomFieldsForProject,
  updateCustomField,
  getCustomFieldIdByName,
  createAsanaTask,
  storiesApiInstance
};
