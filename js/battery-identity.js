(function (root) {
  'use strict';
  function serialOf(battery) {
    const explicit=String(battery.serial || '').trim().toUpperCase();
    if(explicit)return explicit;
    // Older registrations kept the serial in the firmware/observation field.
    const tokens=String(battery.firmware || '').toUpperCase().match(/\b[A-Z0-9]{12,20}\b/g) || [];
    return tokens.length===1 && /[A-Z]/.test(tokens[0]) && /\d/.test(tokens[0]) ? tokens[0] : '';
  }
  function findUnique(batteries, serial) {
    const matches=batteries.filter(b=>!b.duplicateOf && serialOf(b)===String(serial||'').trim().toUpperCase());
    return matches.length===1?matches[0]:null;
  }
  function repairImportedDuplicates(batteries) {
    const changes=[];
    for(const imported of batteries) {
      if(imported.duplicateOf || !imported.lastLogImport || !imported.serial || !/^Bateria [A-Z0-9]{6}$/.test(imported.name||''))continue;
      const originals=batteries.filter(b=>b.id!==imported.id && !b.duplicateOf && !b.lastLogImport && serialOf(b)===serialOf(imported) && String(b.aircraftId)===String(imported.aircraftId));
      if(originals.length!==1)continue;
      // Retain the complete duplicate as a recoverable record; never delete user data.
      imported.duplicateOf=originals[0].id;imported.duplicateReason='legacy-log-auto-created';changes.push(imported);
    }
    return changes;
  }
  root.DroneHubBatteryIdentity={serialOf,findUnique,repairImportedDuplicates};
})(typeof window==='undefined'?globalThis:window);
