import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
const doc = new jsPDF();
autoTable(doc, {
  head: [['A', 'B']],
  body: []
});
console.log('finalY:', doc.lastAutoTable?.finalY);
