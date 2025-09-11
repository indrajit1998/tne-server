import env from "../lib/env";
const cookiesOption={
      httpOnly:true,
      secure:env.NODE_ENV==="development"?false:true,
      maxAge:7*24*60*60*1000, 
    }


export{  cookiesOption}
