const fs = require('fs');
let code = fs.readFileSync('src/deliveries/deliveries.service.ts', 'utf8');

code = code.replace(
    /orderBy: \[\s*\{\s*sequence: 'asc'\s*\},/,
    `orderBy: [
                    { partnerId: 'asc' },
                    { sequence: 'asc' },`
);

fs.writeFileSync('src/deliveries/deliveries.service.ts', code);
console.log("Updated orderBy successfully!");
