/**
 * COACH DEE – ONLINE WAIVER RECEIVER (Google Apps Script)
 *
 * This small program runs in Danielle's Google account. When someone signs
 * the waiver on coachdee.fit/waiver.html, it:
 *   1. saves a PDF of the signed waiver in a Google Drive folder,
 *   2. adds a row to a Google Sheet log in that same folder,
 *   3. emails the client a copy of the PDF from Danielle's Gmail, and sends
 *      Danielle a "New signed waiver" notice with the PDF.
 *
 * Setup steps are in SETUP.md (next to this file).
 */

// ===== SETTINGS (safe to change) =====
var FOLDER_NAME   = 'Coach DEE - Signed Waivers';  // Drive folder for the PDFs and the log
var SHEET_NAME    = 'Coach DEE - Waiver Log';      // Google Sheet that lists every signature
var NOTIFY_EMAILS = [];   // extra people to get the "New signed waiver" notice, e.g. ['someone@gmail.com'] (this account always gets it)
var REPLY_TO      = '';   // when a client replies to their copy; blank = this account
var SHARE_FOLDER_WITH = 'leifedmundson@gmail.com'; // gets edit access to the waiver folder so he can help manage it; set to '' to keep it private
var TIME_ZONE     = 'America/Los_Angeles';
// =====================================

function doGet() {
  return ContentService.createTextOutput('Coach DEE waiver receiver is running.');
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.botcheck) return json_({ ok: true });            // spam bot; quietly ignore
    validate_(d);

    lock.waitLock(30000);
    var now = new Date();
    var folder = getFolder_();
    var day = Utilities.formatDate(now, TIME_ZONE, 'yyyy-MM-dd');
    var baseName = day + ' - ' + safe_(d.participantName) + ' - Waiver';

    // Build a Google Doc, turn it into a PDF, keep the PDF, delete the Doc.
    var doc = DocumentApp.create(baseName), docFile, pdfBlob, pdfFile;
    try {
      buildDoc_(doc, d, now);
      doc.saveAndClose();
      docFile = DriveApp.getFileById(doc.getId());
      pdfBlob = docFile.getAs('application/pdf').setName(baseName + '.pdf');
      pdfFile = folder.createFile(pdfBlob);
    } finally {
      try { DriveApp.getFileById(doc.getId()).setTrashed(true); } catch (ignore) {}
    }

    logRow_(folder, d, now, pdfFile);
    sendEmails_(d, pdfBlob, pdfFile);

    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// ---------- checks ----------
function validate_(d) {
  var need = ['participantName', 'participantDob', 'email', 'phone', 'emergencyName',
              'emergencyRelationship', 'emergencyPhone', 'photoConsent', 'signerName', 'signature'];
  need.forEach(function (k) { if (!d[k] || !String(d[k]).trim()) throw new Error('Missing ' + k); });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw new Error('Bad email');
  if (!/^data:image\/png;base64,/.test(d.signature) || d.signature.length > 3000000) throw new Error('Bad signature');
  if (!Array.isArray(d.clauses) || !d.clauses.length) throw new Error('Missing waiver text');
  d.clauses.forEach(function (c) {
    if (c.paragraphs && c.paragraphs.length && c.title.indexOf('Acknowledgement') !== 0 && !String(c.initials || '').trim()) {
      throw new Error('Missing initials');
    }
  });
}

// ---------- the PDF ----------
function buildDoc_(doc, d, now) {
  var body = doc.getBody();
  body.setMarginTop(54).setMarginBottom(54).setMarginLeft(60).setMarginRight(60);
  var teal = '#183D48', red = '#933C31', grey = '#555555';

  var t = body.getParagraphs()[0];
  t.setText('Release of Liability and Assumption of Risk Agreement');
  t.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  t.editAsText().setForegroundColor(teal).setFontSize(17).setBold(true);
  para_(body, 'Danielle Edmundson · Personal training and coaching · Santa Cruz, California', grey, 10);
  para_(body, 'Signed electronically at coachdee.fit on ' +
        Utilities.formatDate(now, TIME_ZONE, "MMMM d, yyyy 'at' h:mm a z") + '. ' + (d.waiverVersion || ''), grey, 10);

  heading_(body, 'Participant and contact details', red);
  var rows = [
    ['Signed by', d.signerName + ' (' + d.signerType + ')'],
    ['Participant', d.participantName],
    ['Date of birth', d.participantDob],
  ];
  if (d.guardianName) rows.push(['Parent / guardian', d.guardianName + ' (' + d.guardianRelationship + ')']);
  rows.push(['Email', d.email], ['Phone', d.phone]);
  if (d.address) rows.push(['Address', d.address]);
  rows.push(['Emergency contact', d.emergencyName + ' (' + d.emergencyRelationship + '), ' + d.emergencyPhone]);
  rows.push(['Photo / video permission', d.photoConsent]);
  var table = body.appendTable(rows);
  table.setBorderColor('#DDDDDD');
  for (var r = 0; r < table.getNumRows(); r++) {
    var row = table.getRow(r);
    row.getCell(0).setWidth(150).editAsText().setBold(true).setFontSize(10);
    row.getCell(1).editAsText().setFontSize(10);
  }

  heading_(body, 'Agreement text as read and agreed to', red);
  d.clauses.forEach(function (c) {
    var h = body.appendParagraph(c.title);
    h.editAsText().setBold(true).setFontSize(11).setForegroundColor(teal);
    h.setSpacingBefore(10);
    (c.paragraphs || []).forEach(function (p) { para_(body, p, '#1D1D1D', 10); });
    if (c.initials) {
      var ip = body.appendParagraph('Initials: ' + c.initials.toUpperCase());
      ip.editAsText().setFontSize(10).setBold(true).setForegroundColor(red);
    }
  });

  heading_(body, 'Signature', red);
  var bytes = Utilities.base64Decode(d.signature.split(',')[1]);
  var img = body.appendImage(Utilities.newBlob(bytes, 'image/png', 'signature.png'));
  var w = 300, ratio = img.getHeight() / img.getWidth();
  img.setWidth(w).setHeight(Math.round(w * ratio));
  para_(body, d.signerName + (d.guardianName ? ', parent/guardian of ' + d.participantName : ''), '#1D1D1D', 11);
  para_(body, 'Date: ' + Utilities.formatDate(now, TIME_ZONE, 'MMMM d, yyyy'), '#1D1D1D', 11);

  heading_(body, 'Signing record', red);
  para_(body, 'Received: ' + Utilities.formatDate(now, TIME_ZONE, 'yyyy-MM-dd HH:mm:ss z'), grey, 9);
  para_(body, "Signer's device time: " + (d.signedAtLocal || '') + (d.timeZone ? ' (' + d.timeZone + ')' : ''), grey, 9);
  para_(body, 'Page: ' + (d.pageUrl || ''), grey, 9);
  para_(body, 'Browser: ' + (d.userAgent || ''), grey, 9);
}

function para_(body, text, color, size) {
  var p = body.appendParagraph(String(text || ' '));
  p.editAsText().setForegroundColor(color).setFontSize(size).setBold(false);
  p.setSpacingAfter(6);
  return p;
}
function heading_(body, text, color) {
  var p = body.appendParagraph(text.toUpperCase());
  p.editAsText().setForegroundColor(color).setFontSize(10).setBold(true);
  p.setSpacingBefore(16).setSpacingAfter(6);
  return p;
}

// ---------- Drive folder and the log sheet ----------
function getFolder_() {
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  if (it.hasNext()) return it.next();
  var folder = DriveApp.createFolder(FOLDER_NAME);
  if (SHARE_FOLDER_WITH) folder.addEditor(SHARE_FOLDER_WITH);
  return folder;
}

function getSheet_(folder) {
  var files = folder.getFilesByName(SHEET_NAME), ss;
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(SHEET_NAME);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
    var sh = ss.getSheets()[0];
    sh.appendRow(['Signed (Pacific)', 'Participant', 'Date of birth', 'Signed by', 'Parent / guardian',
                  'Email', 'Phone', 'Address', 'Emergency contact', 'Emergency relationship', 'Emergency phone',
                  'Photo / video OK', 'Waiver version', 'PDF']);
    sh.getRange(1, 1, 1, 14).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return ss.getSheets()[0];
}

function logRow_(folder, d, now, pdfFile) {
  getSheet_(folder).appendRow([
    Utilities.formatDate(now, TIME_ZONE, 'yyyy-MM-dd HH:mm'),
    d.participantName, d.participantDob, d.signerName + ' (' + d.signerType + ')',
    d.guardianName ? d.guardianName + ' (' + d.guardianRelationship + ')' : '',
    d.email, d.phone, d.address || '', d.emergencyName, d.emergencyRelationship, d.emergencyPhone,
    d.photoConsent, d.waiverVersion || '', pdfFile.getUrl()
  ]);
}

// ---------- emails ----------
function sendEmails_(d, pdfBlob, pdfFile) {
  var owner = Session.getEffectiveUser().getEmail();
  var team = NOTIFY_EMAILS.concat([owner]).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
  MailApp.sendEmail({
    to: d.email,
    replyTo: REPLY_TO || owner,
    name: 'Danielle Edmundson',
    subject: 'Your signed waiver for training with Danielle Edmundson',
    body: 'Hi ' + d.signerName.split(' ')[0] + ',\n\n' +
          'Thanks for signing the liability waiver for training with Danielle Edmundson' + (d.guardianName ? ' for ' + d.participantName : '') + '. ' +
          'A copy is attached for your records.\n\n' +
          'Questions? Reply to this email or call/text me at 831-345-7779.\n\n' +
          'Danielle Edmundson · coachdee.fit',
    attachments: [pdfBlob]
  });
  MailApp.sendEmail({
    to: team.join(','),
    replyTo: d.email,
    name: 'Coach DEE website',
    subject: 'New signed waiver: ' + d.participantName,
    body: d.signerName + ' signed the waiver' + (d.guardianName ? ' for ' + d.participantName : '') + '.\n\n' +
          'Email: ' + d.email + '\nPhone: ' + d.phone + '\nPhoto/video OK: ' + d.photoConsent + '\n\n' +
          'Saved in Google Drive: ' + pdfFile.getUrl(),
    attachments: [pdfBlob]
  });
}

// ---------- helpers ----------
function safe_(s) { return String(s).replace(/[\\\/:*?"<>|]/g, '').trim().slice(0, 80) || 'Unnamed'; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/**
 * Test from the editor: choose "testWaiver" and press Run. It makes a sample
 * waiver PDF (participant "TEST - delete me") and sends the emails to this
 * account only, so you can check everything works. Delete the test PDF and
 * its row in the log afterwards.
 */
function testWaiver() {
  var me = Session.getEffectiveUser().getEmail();
  var dot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  var res = doPost({ postData: { contents: JSON.stringify({
    waiverVersion: 'TEST', signerType: 'Adult participant', participantName: 'TEST - delete me',
    participantDob: '1990-01-01', email: me, phone: '000-000-0000', address: '',
    emergencyName: 'Test Contact', emergencyRelationship: 'Friend', emergencyPhone: '000-000-0000',
    photoConsent: 'No', signerName: 'Test Signer', signature: dot,
    clauses: [{ title: '1. Test section', paragraphs: ['This is a test.'], initials: 'TT' }],
    signedAtLocal: String(new Date()), timeZone: TIME_ZONE, pageUrl: 'editor test', userAgent: 'editor'
  }) } });
  console.log(res.getContent());
}

/**
 * Run this once from the editor (select "setUp" and press Run) to give the
 * program permission and create the Drive folder and the log sheet.
 */
function setUp() {
  var folder = getFolder_();
  getSheet_(folder);
  console.log('Ready. Folder: ' + folder.getUrl());
}
