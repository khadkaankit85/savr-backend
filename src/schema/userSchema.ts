import mongoose, { CallbackError } from "mongoose";
import bcrypt from "bcrypt";
const { Schema } = mongoose;

const userSchema = new Schema({
  fullName: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  //array of the products tracked by an user
  trackedProducts: [
    {
      //this is the id of the product given from their store:)
      storeProductId: {
        type: Schema.Types.String,
        ref: "Product",
        required: true,
        unique: true
      },
      //when to send the alert
      alertPrice: {
        type: Number,
        required: true,
      },
      //when did the user started tracking the product
      trackedDate: {
        type: Date,
        required: true,
      },
    },
  ],
  /* this is replaced by link sent to email
  otp: {
    lastOtp: {
      type: Number,
      required: false,
    },
    issueDate: {
      type: Date,
      required: false,
    },
  },
  */
  additionalInfo: {
    image: {
      type: String,
      default: null,
    },
    googleId: {
      type: String,
      default: null,
    },
    accountCreatedDate: {
      type: Date,
      default: Date.now(),
    },
    //TODO: if the user is not verified then don't let them login :) until they are verified
    isVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      required: true,
    },
    //this token is sent via email when a new user is created and used to verify the user,expires soon,
    token: {
      value: {
        type: String,
        required: true,
      },
      createdAt: {
        type: Date,
        default: new Date("2025-02-20T00:00:00Z"),
        required: true,
      },
      //the number of token comparison request by user is counted to prevent brute force
      requestCount: {
        type: Number,
        default: 0,
        required: true,
      },
    },
  },
});
userSchema.pre("save", async function (next) {
  const user = this;

  // Hash password if modified
  if (user.isModified("password")) {
    try {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
    } catch (error) {
      return next(error as CallbackError);
    }
  }

  // Update token metadata if token value changes
  if (user.isModified("additionalInfo.token.value")) {
    if (user.additionalInfo && user.additionalInfo.token) {
      user.additionalInfo.token.createdAt = new Date();
      user.additionalInfo.token.requestCount = 0;
    }
  }

  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
