const smartsheet = require('smartsheet');

// Smartsheet Client Configuration
const smartsheetClient = smartsheet.createClient({
  accessToken: process.env.SMARTSHEET_ACCESS_TOKEN
});

// Function to get and log sheet list


// Mapping of submittedData keys to Smartsheet column names
const columnMapping = {
  ProjectNumber_SL: 'Projektszám',
  ProjectName_SL: 'Projektnév',
  AsanaTaskName_SL: 'ASANA TaskName',
  Worker_dropdown: 'Munkavégző',
  date: 'Munkavégzés dátuma',
  Distance_SL: 'Távolság',
  Distance_Time_SL: 'Beírt útidő (ó)',
  radio_button: 'Szerepkör',
  PlateNumber_dropdown: 'Rendszám',
  AsanaTaskID_SL: 'ASANA TaskID',
  UserID: 'UserID', // New column for storing the email
  AsanaTaskLink: 'ASANA TaskLink' // New column for storing the task link
};

const KulsosMunkalapcolumnMapping = {
  ProjectNumber_SL: 'Projektszám',
  Worker_dropdown: 'Munkavégző',
  date: 'Munkavégzés dátuma',
  PV_dropdown: 'Projektvezető',
  PV_Leiras_ML: 'Projektvezető leírása'
};

// Function to get sheet columns and submit data to Smartsheet
async function submitDataToSheet(workspaceId, folderName, sheetName, submittedData) {
 
  if (sheetName=='Projektköltségek'){
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

      // Ensure Distance_SL is treated as a number
      submittedData.Distance_SL = parseFloat(submittedData.Distance_SL) || 0;

      // Check if Distance_Time_SL is empty or 0 and calculate if necessary
      if (!submittedData.Distance_Time_SL || submittedData.Distance_Time_SL == 0) {
        const calculatedTime = (submittedData.Distance_SL / 70).toFixed(2);
        submittedData.Distance_Time_SL = calculatedTime;
        console.log(`km: ${submittedData.Distance_SL} - beírandó érték: ${calculatedTime}`);
      }

      // Prepare the row data
      if (submittedData.Distance_Time_SL) {
        submittedData.Distance_Time_SL = parseFloat(submittedData.Distance_Time_SL.replace(',', '.')); // Ensure it's a number with '.' as a decimal separator
      }
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




      // Add the row to the sheet
      await smartsheetClient.sheets.addRows({ sheetId: sheet.id, body: [row] });
      console.log('Data submitted to Smartsheet');
    } catch (error) {
      console.error('Error submitting data to Smartsheet:', error.message);
    }
  }else{
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
    const row = {
      toBottom: true,
      cells: Object.keys(submittedData).map(key => {
        const columnName = KulsosMunkalapcolumnMapping[key];
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

    // Add the row to the sheet
    await smartsheetClient.sheets.addRows({ sheetId: sheet.id, body: [row] });
    console.log('Külsős munkalap data submitted to Smartsheet');
  } catch (error) {
    console.error('Error submitting Külsős munkalap data to Smartsheet:', error.message);
  }
};
}

// Function to get rows from a sheet by Task ID
async function getRowsByTaskID(workspaceId, folderName, sheetName, taskId) {
  try {
    // Get the workspace
    const workspacesResponse = await smartsheetClient.workspaces.listWorkspaces();
    const workspace = workspacesResponse.data.find(ws => ws.id == workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    // Get the details of the workspace to find the folder
    const workspaceDetails = await smartsheetClient.workspaces.getWorkspace({ id: workspace.id });
    const folder = workspaceDetails.folders.find(f => f.name === folderName);
    if (!folder) throw new Error('Folder not found');

    // Get the details of the folder to find the sheet
    const folderDetails = await smartsheetClient.folders.getFolder({ id: folder.id });
    const sheet = folderDetails.sheets.find(s => s.name === sheetName);
    if (!sheet) throw new Error('Sheet not found');

    // Get the sheet details
    const sheetDetails = await smartsheetClient.sheets.getSheet({ id: sheet.id });

    // Find the column ID for the 'ASANA TaskID' column
    const taskIdColumn = sheetDetails.columns.find(col => col.title === 'ASANA TaskID');
    if (!taskIdColumn) throw new Error('ASANA TaskID column not found');

    // Find the column ID for the 'Távolság' column
    const kilometerColumn = sheetDetails.columns.find(col => col.title === 'Távolság');
    if (!kilometerColumn) throw new Error('Távolság column not found');

    // Filter rows by Task ID and sum the kilometers
    const filteredRows = sheetDetails.rows.filter(row => {
      const taskIdCell = row.cells.find(cell => cell.columnId === taskIdColumn.id);
      return taskIdCell && taskIdCell.value === taskId;
    });

    const totalKilometers = filteredRows.reduce((total, row) => {
      const kilometerCell = row.cells.find(cell => cell.columnId === kilometerColumn.id);
      return total + (kilometerCell ? parseFloat(kilometerCell.value) || 0 : 0);
    }, 0);

    return { filteredRows, totalKilometers };
  } catch (error) {
    console.error('Error fetching rows from Smartsheet:', error.message);
    throw error;
  }
}

module.exports = { submitDataToSheet, getRowsByTaskID };

