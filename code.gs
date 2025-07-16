/* Route
 * All Request with Method Get will be proces here
 */
const IDSPREADSHEET = <<IDSPREADSHEET>>;

function doGet(req) {
   var action = req.parameter.action;
   
   switch(action) {
       case "read":
           return doRead(req);
           break;
       case "read-admin":
           return doReadAdmin(req);
           break;
       case "read-spam":
           return doReadSpam(req);
           break;
       case "update":
           return doUpdate(req);
           break;
       case "delete":
           return doDelete(req, sheetUsers);
           break;
        case "save-record-message":
           return _saveRecordMessage(req);
           break;
       default:
           return response().json({
              status: false,
              message: 'silent!'
           });
   }
}

function _saveRecordMessage(req){
  
  var id = req.parameter.id;
  var no = req.parameter.no;
  var name = req.parameter.name;
  var message = req.parameter.message;
  var status = req.parameter.status;

  var db = SpreadsheetApp.openById(IDSPREADSHEET);
  
  // Don't forget to change your Sheet Name by default is 'Sheet1'
  var sheetUsers = db.getSheetByName("save-record-message");
  
   // all data your needed

   var flag = 1;
   var Row = sheetUsers.getLastRow();
   for (var i = 1; i <= Row; i++) {
      /* getRange(i, 2) 
       * i | is a row index
       * 1 | is a id column index ('id')
       */
      var idTemp = sheetUsers.getRange(i, 1).getValue();
      if (idTemp == id) {
         flag = 0;
         var result = "Sorry bratha, id already exist";
      }
   }
   
   // add new row with recieved parameter from client
   if (flag == 1) {
      var timestamp = Date.now();
      var currentTime = new Date().toLocaleString(); // Full Datetime
      var rowData = sheetUsers.appendRow([
         id,
         no,
         name,
         message,
         timestamp,
         currentTime,
         status,
      ]);
      var result = "Insertion successful";
   }

   return response().json({
      result: result
   }); 

}

/* Read
 * request for all Data
 *
 * @request-parameter | action<string>
 * @example-request | ?action=read
 */
function doRead(request) 
{
  var db = SpreadsheetApp.openById(IDSPREADSHEET);
  
  // Don't forget to change your Sheet Name by default is 'Sheet1'
  var sheetUsers = db.getSheetByName("custom-message");

   var data = {};
   
   data.records = _readData(sheetUsers);

   return response().json(data);

}

function doReadAdmin(request) 
{
  var db = SpreadsheetApp.openById(IDSPREADSHEET);
  
  // Don't forget to change your Sheet Name by default is 'Sheet1'
  var sheetUsers = db.getSheetByName("custom-admin");

   var data = {};
   
   data.records = _readData(sheetUsers);

   return response().json(data);

}

function doReadSpam(request) 
{
  var db = SpreadsheetApp.openById(IDSPREADSHEET);
  
  // Don't forget to change your Sheet Name by default is 'Sheet1'
  var sheetUsers = db.getSheetByName("tujuan-spam");

   var data = {};
   
   data.records = _readData(sheetUsers);

   return response().json(data);

}

/* Insert
 *
 */
function doInsert(req, sheet) {
   var id = req.parameter.id;
   var username = req.parameter.username;
   var email = req.parameter.email;
   // all data your needed

   var flag = 1;
   var Row = sheet.getLastRow();
   for (var i = 1; i <= Row; i++) {
      /* getRange(i, 2) 
       * i | is a row index
       * 1 | is a id column index ('id')
       */
      var idTemp = sheet.getRange(i, 1).getValue();
      if (idTemp == id) {
         flag = 0;
         var result = "Sorry bratha, id already exist";
      }
   }
   
   // add new row with recieved parameter from client
   if (flag == 1) {
      var timestamp = Date.now();
      var currentTime = new Date().toLocaleString(); // Full Datetime
      var rowData = sheet.appendRow([
         id,
         username,
         email,
         timestamp,
         currentTime
      ]);
      var result = "Insertion successful";
   }

   return response().json({
      result: result
   });
}

/* Update
 * request for Update
 *
 * @request-parameter | id<string>, data<JSON>, action<string>
 * @example-request | ?action=update&data={"email":"ryandevstudio@gmail.com", "username":"nyancodeid"}
 */
function doUpdate(req) {
    var db = SpreadsheetApp.openById("1g-dWZ00crPxZO_SgncV_h51K_Vfv9PexZlgGRcyIDb4");
    var sheet = db.getSheetByName("tujuan"); // Ganti dengan nama Sheet Anda
    var phoneNumberToSearch = req.parameter.id; // ID yang akan dicari di kolom A
    var statusUpdate = req.parameter.status; // Status baru yang akan ditulis di kolom D
    var data = sheet.getDataRange().getValues(); // Ambil semua data dari sheet

    // Loop melalui semua baris data
    for (var i = 0; i < data.length; i++) {
        if (data[i][0] == phoneNumberToSearch) { // Kolom A adalah indeks 0 di array data
            sheet.getRange(i + 1, 4).setValue(statusUpdate); // Set status di kolom D, baris (i+1)
            break; // Keluar dari loop setelah menemukan dan mengupdate record
        }
    }
}


/* Delete
 *
 */
function doDelete(req, sheet) {
   var id = req.parameter.id;
   var flag = 0;

   var Row = sheet.getLastRow();
   for (var i = 1; i <= Row; i++) {
      var idTemp = sheet.getRange(i, 1).getValue();
      if (idTemp == id) {
         sheet.deleteRow(i);
         
         var result = "deleted successfully";
         flag = 1;
      }

   }

   if (flag == 0) {
      return response().json({
         status: false,
         message: "ID not found"
      });
   }

   return response().json({
      status: true,
      message: result
   });
}


/* Service
 */
function _readData(sheetObject, properties) {

   if (typeof properties == "undefined") {
      properties = _getHeaderRow(sheetObject);
      properties = properties.map(function (p) {
         return p.replace(/\s+/g, '_');
      });
   }

   var rows = _getDataRows(sheetObject),
      data = [];

   for (var r = 0, l = rows.length; r < l; r++) {
      var row = rows[r],
          record = {};

      for (var p in properties) {
         record[properties[p]] = row[p];
      }
      data.push(record);
      
   }
   
   return data;
}
function _getDataRows(sheetObject) {
   var sh = sheetObject;

   return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
}
function _getHeaderRow(sheetObject) {
   var sh = sheetObject;

   return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}
function response() {
   return {
      json: function(data) {
         return ContentService
            .createTextOutput(JSON.stringify(data))
            .setMimeType(ContentService.MimeType.JSON);
      }
   }
}