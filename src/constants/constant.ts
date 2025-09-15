import env from "../lib/env";
import { Types } from "mongoose";
const cookiesOption={
      httpOnly:true,
      secure:env.NODE_ENV==="development"?false:true,
      maxAge:7*24*60*60*1000, 
    }
const notificationHelper = (type:string, consignment:{description:string}, userId: Types.ObjectId) => {
  switch(type){
    case "bySender":
      return {
        title:"New Carry Request",
        message:`You have a new carry request for consignment ${consignment.description} from sender ${userId}`
      }
    case "byTraveller":
      return {
        title:"New Carry Request",
        message:`You have a new carry request for consignment ${consignment.description} from traveller ${userId}`
      }
  }
}
export{  cookiesOption, notificationHelper  }
