import { user } from "../model/user.js";
import { chat } from "../model/chat.js";
import { chatHistory } from "../model/chatHistory.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Error } from "mongoose";

export const getGeminiHome = (req, res, next) => {
  res.status(200).json({ message: "Welcome to Gemini Ai Api" });
};

// post gemini data add to db condition

// if chatHistoryId -> check old chatHistory else create new chatHistory

// if chatHistoryId -> push old chat -> create new chat

// add chat to chatHistory only first one

// add chatHistory to user

let b = 0;

export const postGemini = async (req, res, next) => {
  const clientApikey = String(req.headers["x-api-key"]);
  const serverSideClientApiKey = String(process.env.CLIENT_API_KEY);

  if (clientApikey !== serverSideClientApiKey) {
    const error = new Error("Invalid Api Key");
    error.statusCode = 401;
    error.data = "Invalid Api Key";
    return next(error);
  }
  const query = String(req.body.userInput);
  const previousChat = req.body.previousChat;
  const chatHistoryId = req.body.chatHistoryId;

  let history = [
    {
      role: "user",
      parts: "Hello, who are you.",
    },
    {
      role: "model",
      parts: "I am a large language model, trained by Google.",
    },
  ];

  if (previousChat.length > 0) history = [...history, ...previousChat];

  const genAi = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = genAi.getGenerativeModel({ model: "gemini-pro" });

  const chats = model.startChat({
    history: history,
  });

  let text;
  let newChatHistoryId;
  let chatId;

  chats
    .sendMessage(query)
    .then((result) => {
      return result.response;
    })
    .then((response) => {
      text = response.text();

      if (text.length < 5) {
        const error = new Error("result not found");
        error.statusCode = 403;
        throw error;
      }

      if (chatHistoryId.length < 5) {
        const newChatHistory = new chatHistory({
          user: req.user._id,
          title: query,
        });

        return newChatHistory.save();
      } else {
        return chatHistory.findById(chatHistoryId);
      }
    })
    .then((chatHistory) => {
      if (!chatHistory) {
        const error = new Error("Chat History not found");
        error.statusCode = 403;
        throw error;
      }

      newChatHistoryId = chatHistory._id;

      if (chatHistoryId.length < 5) {
        const newChat = new chat({
          chatHistory: newChatHistoryId,
          messages: [
            {
              sender: req.user._id,
              message: {
                user: query,
                gemini: text,
              },
            },
          ],
        });

        return newChat.save();
      } else {
        return chat
          .findOne({ chatHistory: chatHistory._id })
          .then((chatData) => {
            if (!chatData) {
              const error = new Error("no chat found");
              error.statusCode = 403;
              throw error;
            }

            chatData.messages.push({
              sender: req.user._id,
              message: {
                user: query,
                gemini: text,
              },
            });

            return chatData.save();
          });
      }
    })
    .then((result) => {
      chatId = result._id;

      if (!result) {
        throw new Error("Server Error");
      }

      if (chatHistoryId.length < 5) {
        return chatHistory.findById(newChatHistoryId).then((chatHistory) => {
          if (!chatHistory) {
            const error = new Error("Chat History not found");
            error.statusCode = 403;
            throw error;
          }

          chatHistory.chat = chatId;
          return chatHistory.save();
        });
      } else {
        return true;
      }
    })
    .then((result) => {
      if (!result) {
        throw new Error("Server Error");
      }

      return user.findById(req.user._id);
    })
    .then((userDate) => {
      if (!userDate) {
        const error = new Error("No user found");
        error.statusCode = 403;
        throw error;
      }

      if (chatHistoryId.length < 5) {
        userDate.chatHistory.push(newChatHistoryId);
        return userDate.save();
      } else {
        return true;
      }
    })
    .then((result) => {
      if (!result) {
        throw new Error("Server Error");
      }

      b += 1;

      console.log("new chat ", b);

      res.status(200).json({
        user: query,
        gemini: text,
        chatHistoryId: newChatHistoryId || chatHistoryId,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

let c = 0;

export const getChatHistory = (req, res, next) => {
  user
    .findById(req.user._id)
    .populate({ path: "chatHistory" })
    .then((userData) => {
      if (!user) {
        const error = new Error("User Not Found");
        error.statusCode = 403;
        throw error;
      }
      c += 1;
      console.log("chat history", c);
      res.status(200).json({
        chatHistory: userData.chatHistory.reverse(),
        location: userData.location,
      });
    })
    .catch((error) => {
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      next(error);
    });
};

let a = 0;

export const postChat = (req, res, next) => {
  const chatHistoryId = req.body.chatHistoryId;
  chatHistory
    .find({ user: req.user._id, _id: chatHistoryId })
    .populate({
      path: "chat",
    })
    .then((chatData) => {
      if (!chatData) {
        const error = new Error("No Chathistory found");
        error.statusCode - 403;
        throw error;
      }

      a += 1;
      console.log("old chats ", a);

      res.status(200).json({
        chatHistory: chatData[0]._id,
        chats: chatData[0].chat.messages,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

let d = 0;

export const updateLocation = (req, res, next) => {
  const { lat, long } = req.body.location;

  const apiKey = process.env.LOCATION_API_KEY;

  const url = `https://geocode.maps.co/reverse?lat=${lat}&lon=${long}&api_key=${apiKey}`;

  let location;

  fetch(url)
    .then((response) => {
      if (!response) {
        const error = new Error("Location Not Found");
        error.statusCode = 403;
        throw error;
      }

      return response.json();
    })
    .then((data) => {
      location = `${data.address.city}, ${data.address.state}, ${data.address.country}`;

      return user.findById(req.user._id);
    })
    .then((user) => {
      if (!user) {
        const error = new Error("User Not Found");
        error.statusCode = 403;
        throw error;
      }

      user.location = location;

      return user.save();
    })
    .then((result) => {
      if (!result) {
        const error = new Error("No Result");
        error.statusCode = 403;
        throw error;
      }
      d += 1;
      console.log("location", d);
      res.status(200).json({ location: location });
    })
    .catch((error) => {
      if (!res.statusCode) {
        res.statusCode = 500;
      }
      next(error);
    });
};
