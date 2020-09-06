const XLSX = require('xlsx');
var workbook = XLSX.readFile('./data/k-table.xls');

var sheet_name_list = workbook.SheetNames;
data = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

console.log("data:", data)

// for(var key in data){
//     console.log(data[key]);
// }