import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './.env' });

import { getPayouts, exportPayouts } from './src/controllers/admin/payoutManagement.js';

async function run() {
  await mongoose.connect(process.env.DATABASE_URL);
  
  const req = {
    query: { limit: 10 }
  };
  
  const res = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      console.log("JSON response from getPayouts:");
      if (data && data.data && data.data.data) {
        data.data.data.forEach(p => {
          console.log(`User: ${p.user?.firstName}, A/C: ${p.bankDetails?.accountNumber}`);
        });
      } else {
        console.log("Unexpected data format", data);
      }
      return this;
    },
    setHeader: function(k, v) { console.log(`Header ${k}: ${v}`); },
    send: function(csv) {
      console.log("CSV response from exportPayouts:");
      console.log(csv);
      return this;
    }
  };

  await getPayouts(req, res);
  
  console.log("-------------------");
  await exportPayouts(req, res);
  
  process.exit(0);
}

run().catch(console.error);
