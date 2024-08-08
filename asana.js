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
  let opts = { 
    'opt_fields': "name,projects"
  };

  try {
    const result = await tasksApiInstance.getTask(taskId, opts);
    const task = result.data;
   
    const project = task.projects.length > 0 ? task.projects[0] : null;
    let projectName = '';
    let projectId = '';

    if (project) {
      const projectResult = await projectsApiInstance.getProject(project.gid);
      projectName = projectResult.data.name;
      projectId = project.gid;
    }

    // Split project name into project number and project name
    const [projectNumber, projectTaskName] = projectName.includes(' - ') ? projectName.split(' - ') : [projectName, ''];

    return {
      projectName: projectTaskName || projectName,
      projectId: projectId,
      projectNumber: projectNumber,
      taskName: task.name,
      taskId: taskId // Include the taskId here
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

  try {
    const result = await customFieldSettingsApiInstance.getCustomFieldSettingsForProject(projectId, opts);
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
    const customFieldGid = await getCustomFieldIdByName(projectId, 'Kilométerköltség');
    if (!customFieldGid) {
      console.log('Custom field "Kilométerköltség" not found.');
      return;
    }

    let customFieldValue = { 
      'body': { 
        'data': { 
          'number_value': totalKilometers 
        }
      }
    };

    // Update the custom field value
    await customFieldsApiInstance.updateCustomField(customFieldGid, customFieldValue);
    console.log(`Custom field 'Kilométerköltség' updated successfully for task ${taskId} with ${totalKilometers} kilometers.`);
  } catch (error) {
    console.error('Error updating custom field:', error.message);
    throw error;
  }
}

module.exports = {
  getTaskDetails,
  getUserDetails,
  getCustomFieldsForProject,
  updateCustomField,
  storiesApiInstance
};
s