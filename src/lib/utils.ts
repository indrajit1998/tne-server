import axios from 'axios';
import FormData from 'form-data';
interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

function formatDuration(startDate: string, endDate: string) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  if (end < start) throw new Error('End date cannot be before start date');

  let diffMs = end - start;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  diffMs -= days * 1000 * 60 * 60 * 24;

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  diffMs -= hours * 1000 * 60 * 60;

  const minutes = Math.floor(diffMs / (1000 * 60));
  diffMs -= minutes * 1000 * 60;

  const parts = [];
  if (days) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);

  return parts.join(' ');
}

function calculateVolumetricWeight(
  length: number,
  width: number,
  height: number,
  unit: 'cm' | 'in' = 'cm',
) {
  if (unit === 'in') {
    length *= 2.54;
    width *= 2.54;
    height *= 2.54;
  }
  let volumetricWeight = (length * width * height) / 5000; // in kg

  return volumetricWeight;
}

function calculateTravellerEarning(modelOfTravel: string, consignment: any) {
  let earning;
  switch (modelOfTravel) {
    case 'air':
      earning = consignment.flightPrice.travelerEarn;
      break;
    case 'roadways':
      earning = consignment.roadWaysPrice.travelerEarn;
      break;
    case 'train':
      earning = consignment.trainPrice.travelerEarn;
      break;
  }
  return earning;
}

function calculateSenderPay(modelOfTravel: string, consignment: any) {
  let pay;
  switch (modelOfTravel) {
    case 'air':
      pay = consignment.flightPrice.senderPay;
      break;
    case 'roadways':
      pay = consignment.roadWaysPrice.senderPay;
      break;
    case 'train':
      pay = consignment.trainPrice.senderPay;
      break;
  }
  return pay;
}

export async function generateOtp(phoneNumber: string, type?: 'sender' | 'receiver') {
  const generateRandomOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

  const otp = generateRandomOtp();

  // ✅ Log OTP for dev
  // console.log(`🔐 Travel OTP generation done, skipped sending in dev mode... `);

  const message =
    type === 'receiver'
      ? `Please use OTP ${otp} to accept the Consignment from the Sender after checking the Package. Do not share the OTP over phone. Regards, Timestrings System Pvt. Ltd`
      : type === 'sender'
      ? `Please use OTP ${otp} to Collect the Consignment from the Traveler after checking the Package. Do not share the OTP over phone. Regards, Timestrings System Pvt. Ltd`
      : `${otp} is OTP to Login to Timestrings System App. Do not share with anyone.`;

  const dltTemplateId =
    type === 'sender'
      ? '1707173408029753777' // sender template
      : type === 'receiver'
      ? '1707173408034076405' // receiver template
      : '1707173408029753777'; // fallback for login

  const formData = new FormData();
  formData.append('userid', 'timestrings');
  formData.append('password', 'X82w2G4f');
  formData.append('mobile', phoneNumber);
  formData.append('senderid', 'TMSSYS');
  formData.append('dltEntityId', '1701173330327453584');
  formData.append('msg', message);
  formData.append('sendMethod', 'quick');
  formData.append('msgType', 'text');
  formData.append('dltTemplateId', dltTemplateId);
  formData.append('output', 'json');
  formData.append('duplicatecheck', 'true');
  formData.append('dlr', '1');

  try {
    const smsResponse = await axios.post('https://app.pingbix.com/SMSApi/send', formData, {
      headers: {
        ...formData.getHeaders(), // ✅ only in Node.js
        Cookie: 'SERVERID=webC1',
      },
      maxBodyLength: Infinity,
    });

    console.log('✅ SMS API Response:', smsResponse.data);
    return { otp, response: smsResponse.data };
  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    throw error;
  }

  // For Dev mode
  // return { otp };
}

const formatCoordinates = (coords?: GeoPoint) => {
  if (!coords || !Array.isArray(coords.coordinates)) return null;
  return {
    latitude: coords.coordinates[1],
    longitude: coords.coordinates[0],
  };
};

export {
  calculateSenderPay,
  calculateTravellerEarning,
  calculateVolumetricWeight,
  formatCoordinates,
  formatDuration,
};
