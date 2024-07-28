const smartsheet = require('smartsheet');

// Smartsheet Client Configuration
const smartsheetClient = smartsheet.createClient({
  accessToken: process.env.SMARTSHEET_ACCESS_TOKEN
});

// Function to get and log sheet list
function logWorkspaceList() {
  smartsheetClient.workspaces.listWorkspaces()
    .then(function(workspaceList) {
      console.log('Workspaces in Smartsheet:', workspaceList);
    })
    .catch(function(error) {
      console.error('Error listing workspaces:', error.message);
    });
}

// Mapping of submittedData keys to Smartsheet column names
const columnMapping = {
  ProjectNumber_SL: 'Projektszám',
  ProjectName_SL: 'Projektnév',
  AsanaTaskName_SL: 'ASANA TaskName',
  Worker_dropdown: 'Munkavégző',
  date: 'Munkavégzés Dátuma',
  Distance_SL: 'Kilóméter',
  radio_button: 'Szerepkör',
  PlateNumber_dropdown:'Rendszám'
};

// Function to get sheet columns and submit data to Smartsheet
async function submitDataToSheet(workspaceId, folderName, sheetName, submittedData) {
  try {
    // Get the workspace
    const workspacesResponse = await smartsheetClient.workspaces.listWorkspaces();
    const workspace = workspacesResponse.data.find(ws => ws.id == workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    console.log(`Found workspace: ${workspace.name}`);

    // Get the details of the workspace to find the folder
    const workspaceDetails = await smartsheetClient.workspaces.getWorkspace({ id: workspace.id });
    const folder = workspaceDetails.folders.find(f => f.name === folderName);
    if (!folder) throw new Error('Folder not found');

    console.log(`Found folder: ${folder.name}`);

    // Get the details of the folder to find the sheet
    const folderDetails = await smartsheetClient.folders.getFolder({ id: folder.id });
    const sheet = folderDetails.sheets.find(s => s.name === sheetName);
    if (!sheet) throw new Error('Sheet not found');

    console.log(`Found sheet: ${sheet.name}`);

    // Get the columns of the sheet
    const sheetDetails = await smartsheetClient.sheets.getSheet({ id: sheet.id });
    const columns = sheetDetails.columns.reduce((map, col) => {
      map[col.title] = col.id;
      return map;
    }, {});

    console.log('Columns:', columns);

    // Prepare the row data
    const row = {
      toBottom: true,
      cells: Object.keys(submittedData).map(key => {
        const columnName = columnMapping[key];
        const columnId = columns[columnName];
        if (!columnId) {
          throw new Error(`Column ID for key ${key} not found`);
        }
        return {
          columnId: columnId,
          value: submittedData[key]
        };
      })
    };

    console.log('Row:', row);

    // Add the row to the sheet
    await smartsheetClient.sheets.addRows({ sheetId: sheet.id, body: [row] });
    console.log('Data submitted to Smartsheet');
  } catch (error) {
    console.error('Error submitting data to Smartsheet:', error.message);
  }
}

module.exports = { logWorkspaceList, submitDataToSheet };
