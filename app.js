const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
//Initializing database and server

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//Converting User table database to response object

const convertUserDbObjectToResponseObject = (dbObject) => {
  return {
    userId: dbObject.user_id,
    name: dbObject.name,
    username: dbObject.username,
    password: dbObject.password,
    gender: dbObject.gender,
  };
};

// Converting Follower table database object to response object

const convertFollowerDbObjectToResponseObject = (dbObject) => {
  return {
    followerId: dbObject.follower_id,
    followerUserId: dbObject.follower_user_id,
    followingUserId: dbObject.following_user_id,
  };
};

// Converting Tweet table database object to response object

const convertTweetDbObjectToResponseObject = (dbObject) => {
  return {
    tweetId: dbObject.tweet_id,
    tweet: dbObject.tweet,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  };
};

// Converting Reply database object to response object

const convertReplyDbObjectToResponseObject = (dbObject) => {
  return {
    replyId: dbObject.reply_id,
    tweetId: dbObject.tweet_id,
    reply: dbObject.reply,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  };
};

//Converting Like table database object to response object

const convertLikeTableDbObjectToResponseObject = (dbObject) => {
  return {
    likeId: dbObject.like_id,
    tweetId: dbObject.tweet_id,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  };
};

//API 1 New user registration and checking various scenarios using POST Method

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser) {
    response.status(400);
    response.send("User already exists");
  } else if (password.length < 6) {
    response.status(400);
    response.send("Password is too short");
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    const addNewUserQuery = `INSERT INTO user (name, username, password, gender) VALUES ('${name}', '${username}', '${hashedPassword}', '${gender}');`;
    await db.run(addNewUserQuery);
    response.send("User created successfully");
  }
});

// API 2 checking login on various scenarios using POST method

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (!dbUser) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (!isPasswordMatched) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
    }
  }
});

// Authentication with JWT Token under various scenarios

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (!authHeader) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwtToken = authHeader.split(" ")[1];
    jwt.verify(jwtToken, "MY_SECRET_KEY", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// API 3 Returns the latest tweets of people whom the user follows. Return 4 tweets at a time using GET Method

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  const followingUsersQuery = `
      SELECT following_user_id FROM follower
      WHERE follower_user_id = ${dbUser.user_id};`;
  const followingUsersObjectsList = await db.all(followingUsersQuery);
  const followingUsersList = followingUsersObjectsList.map((object) => {
    return object["following_user_id"];
  });
  const getTweetsQuery = `
    SELECT
      user.username AS username,
      tweet.tweet AS tweet,
      tweet.date_time AS dateTime
    FROM
      tweet INNER JOIN user ON tweet.user_id = user.user_id
    WHERE
      tweet.user_id IN (${followingUsersList})
    ORDER BY tweet.date_time DESC
    LIMIT 4;
    `;
  const tweets = await db.all(getTweetsQuery);
  response.send(tweets);
});

//API 4 Returns the list of all names of people whom the user follows using GET Method

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  const followingUsersQuery = `
    SELECT following_user_id FROM follower
    WHERE follower_user_id = ${dbUser.user_id};`;
  const followingUsersObjectsList = await db.all(followingUsersQuery);
  const followingUsersList = followingUsersObjectsList.map((object) => {
    return object["following_user_id"];
  });
  const getFollowingQuery = `
  SELECT
    user.name AS name
  FROM
    user
  WHERE
    user_id IN (${followingUsersList});`;
  const following = await db.all(getFollowingQuery);
  response.send(following);
});

//API 5 Returns the list of all names of people who follows the user using GET Method

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  const followerUsersQuery = `
    SELECT follower_user_id FROM follower
    WHERE following_user_id = ${dbUser.user_id};`;
  const followerUsersObjectsList = await db.all(followerUsersQuery);
  const followerUsersList = followerUsersObjectsList.map((object) => {
    return object["follower_user_id"];
  });
  const getFollowersQuery = `
  SELECT
    user.name AS name
  FROM
    user
  WHERE
    user_id IN (${followerUsersList});`;
  const followers = await db.all(getFollowersQuery);
  response.send(followers);
});

//API 6

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const selectUserQuery = `
      SELECT * FROM user WHERE username = '${username}'
      `;
  const dbUser = await db.get(selectUserQuery);
  const getTweetQuery = `
      SELECT * FROM tweet WHERE tweet_id = ${tweetId};
      `;
  const tweetInfo = await db.get(getTweetQuery);
  const followingUsersQuery = `
      SELECT following_user_id FROM follower
      WHERE follower_user_id = ${dbUser.user_id};
      `;
  const followingUsersObjectList = await db.all(followingUsersQuery);
  const followingUsersList = followingUsersObjectList.map((object) => {
    return object["following_user_id"];
  });
  if (!followingUsersList.includes(tweetInfo.user_id)) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const { tweet_id, date_time, tweet } = tweetInfo;
    const getLikesQuery = `
          SELECT COUNT(like_id) AS likes FROM like
          WHERE tweet_id = ${tweet_id} GROUP BY tweet_id;
          `;
    const likesObject = await db.get(getLikesQuery);
    const getRepliesQuery = `
    SELECT COUNT(reply_id) AS replies FROM reply
    WHERE tweet_id = ${tweet_id} GROUP BY tweet_id;
    `;
    const repliesObject = await db.get(getRepliesQuery);
    response.send({
      tweet,
      likes: likesObject.likes,
      replies: repliesObject.replies,
      dateTime: date_time,
    });
  }
});

//API 7

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
    const dbUser = await db.get(selectUserQuery);
    const getTweetQuery = `SELECT * FROM tweet WHERE tweet_id = ${tweetId};`;
    const tweetInfo = await db.get(getTweetQuery);
    const followingUsersQuery = `
    SELECT following_user_id FROM follower
    WHERE follower_user_id = ${dbUser.user_id};`;
    const followingUsersObjectsList = await db.all(followingUsersQuery);
    const followingUsersList = followingUsersObjectsList.map((object) => {
      return object["following_user_id"];
    });
    if (!followingUsersList.includes(tweetInfo.user_id)) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const { tweet_id, date_time } = tweetInfo;
      const getLikesQuery = `
        SELECT user_id FROM like WHERE tweet_id = ${tweet_id};`;
      const likedUserIdObjectsList = await db.all(getLikesQuery);
      const likedUserIdsList = likedUserIdObjectsList.map((object) => {
        return object.user_id;
      });
      const getLikedUsersQuery = `
        SELECT username FROM user
        WHERE user_id IN (${likedUserIdsList});
        `;
      const likedUsersObjectsList = await db.all(getLikedUsersQuery);
      const likedUsersList = likedUsersObjectsList.map((object) => {
        return object.username;
      });
      response.send({ likes: likedUsersList });
    }
  }
);

//API 8

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
    const dbUser = await db.get(selectUserQuery);
    const getTweetQuery = `SELECT * FROM tweet WHERE tweet_id = ${tweetId};`;
    const tweetInfo = await db.get(getTweetQuery);
    const followingUsersQuery = `
    SELECT following_user_id FROM follower
    WHERE follower_user_id = ${dbUser.user_id};`;
    const followingUsersObjectsList = await db.all(followingUsersQuery);
    const followingUsersList = followingUsersObjectsList.map((object) => {
      return object["following_user_id"];
    });
    if (!followingUsersList.includes(tweetInfo.user_id)) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const { tweet_id, date_time } = tweetInfo;
      const getUserRepliesQuery = `
        SELECT user.name AS name, reply.reply AS reply 
        FROM reply 
        INNER JOIN user ON reply.user_id = user.user_id
        WHERE reply.tweet_id = ${tweet_id};`;
      const UserRepliesObject = await db.all(getUserRepliesQuery);
      response.send({ replies: UserRepliesObject });
    }
  }
);

//API 9 Returns a list of all tweets of the user using GET Method

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  const { user_id } = dbUser;
  const getTweetsQuery = `
    SELECT * FROM tweet WHERE user_id = ${user_id}
    ORDER BY tweet_id;`;
  const tweetObjectsList = await db.all(getTweetsQuery);
  const tweetIdsList = tweetObjectsList.map((object) => {
    return object.tweet_id;
  });
  const getLikesQuery = `
    SELECT COUNT(like_id) AS likes FROM like
    WHERE tweet_id IN (${tweetIdsList}) GROUP BY tweet_id ORDER BY tweet_id;`;
  const likesObjectsList = await db.all(getLikesQuery);
  const getRepliesQuery = `
  SELECT COUNT(reply_id) AS replies FROM reply
  WHERE tweet_id IN (${tweetIdsList}) GROUP BY tweet_id
  ORDER BY tweet_id;`;
  const repliesObjectsList = await db.all(getRepliesQuery);
  response.send(
    tweetObjectsList.map((tweetObj, index) => {
      const likes = likesObjectsList[index] ? likesObjectsList[index].likes : 0;
      const replies = repliesObjectsList[index]
        ? repliesObjectsList[index].replies
        : 0;
      return {
        tweet: tweetObj.tweet,
        likes,
        replies,
        dateTime: tweetObj.date_time,
      };
    })
  );
});

//API 10 Create a tweet in the tweet table using POST Method

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  const { user_id } = dbUser;
  const { tweet } = request.body;
  const dateString = new Date().toISOString();
  const dateTime = dateString.slice(0, 10) + " " + dateString.slice(11, 19);
  const addNewTweetQuery = `
    INSERT INTO tweet (tweet, user_id, date_time)
    VALUES ('${tweet}', ${user_id}, '${dateTime}');`;
  await db.run(addNewTweetQuery);
  response.send("Created a Tweet");
});

//API 11 deleting tweets using DELETE Method

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
    const dbUser = await db.get(selectUserQuery);
    const getTweetQuery = `SELECT * FROM tweet WHERE tweet_id = ${tweetId};`;
    const tweetInfo = await db.get(getTweetQuery);
    if (dbUser.user_id !== tweetInfo.user_id) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteTweetQuery = `
        DELETE FROM tweet WHERE tweet_id = ${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;
