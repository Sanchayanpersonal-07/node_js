const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "goodreads.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

app.get("/books/", async (request, response) => {
  const getBooksQuery = `
    SELECT
      *
    FROM
      book
    ORDER BY
      book_id;`;
  const booksArray = await db.all(getBooksQuery);
  response.send(booksArray);
});

app.get("/books/:bookId/", async (request, response) => {
  const { bookId } = request.params;
  const getBookQuery = `
      SELECT
        *
      FROM
        book
      WHERE
        book_id = ${bookId};`;
  const book = await db.get(getBookQuery);
  response.send(book);
});

app.post("/books/", async (request, response) => {
  const bookDetails = request.body;
  const {
    title,
    authorId,
    rating,
    ratingCount,
    reviewCount,
    description,
    pages,
    dateOfPublication,
    editionLanguage,
    price,
    onlineStores,
  } = bookDetails;
  const addBookQuery = `
      INSERT INTO
        book (title,author_id,rating,rating_count,review_count,description,pages,date_of_publication,edition_language,price,online_stores)
      VALUES
        (
          '${title}',
           ${authorId},
           ${rating},
           ${ratingCount},
           ${reviewCount},
          '${description}',
           ${pages},
          '${dateOfPublication}',
          '${editionLanguage}',
           ${price},
          '${onlineStores}'
        );`;

  const dbResponse = await db.run(addBookQuery);
  const bookId = dbResponse.lastID;
  response.send({ bookId: bookId });
});

app.put("/books/:bookId/", async (request, response) => {
  const { bookId } = request.params;
  const bookDetails = request.body;
  const {
    title,
    authorId,
    rating,
    ratingCount,
    reviewCount,
    description,
    pages,
    dateOfPublication,
    editionLanguage,
    price,
    onlineStores,
  } = bookDetails;
  const updateBookQuery = `
      UPDATE
        book
      SET
        title='${title}',
        author_id=${authorId},
        rating=${rating},
        rating_count=${ratingCount},
        review_count=${reviewCount},
        description='${description}',
        pages=${pages},
        date_of_publication='${dateOfPublication}',
        edition_language='${editionLanguage}',
        price=${price},
        online_stores='${onlineStores}'
      WHERE
        book_id = ${bookId};`;
  await db.run(updateBookQuery);
  response.send("Book Updated Successfully");
});

app.delete("/books/:bookId/", async (request, response) => {
  const { bookId } = request.params;
  const deleteBookQuery = `
      DELETE FROM
        book
      WHERE
        book_id = ${bookId};`;
  await db.run(deleteBookQuery);
  response.send("Book Deleted Successfully");
});

app.get("/authors/:authorId/books/", async (request, response) => {
  const { authorId } = request.params;
  const getAuthorBooksQuery = `
      SELECT
       *
      FROM
       book
      WHERE
        author_id = ${authorId};`;
  const booksArray = await db.all(getAuthorBooksQuery);
  response.send(booksArray);
});

app.get("/books/", async (request, response) => {
  const {
    offset = 2,
    limit = 5,
    order = "ASC",
    order_by = "book_id",
    search_q = "",
  } = request.query;
  const getBooksQuery = `
      SELECT
        *
      FROM
       book
      WHERE
       title LIKE '%${search_q}%'
      ORDER BY ${order_by} ${order}
      LIMIT ${limit} OFFSET ${offset};`;
  const booksArray = await db.all(getBooksQuery);
  response.send(booksArray);
});

// Authentication
//Register User API
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  // bcrypt package provides methods to perform operations like encryption, comparison, etc.(npm install bcrypt --save)
  // bcrypt.hash() uses various processes and encrypts the given password and makes it unpredictable.
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
          INSERT INTO 
            user (username, name, password, gender, location) 
          VALUES 
            (
              '${username}', 
              '${name}',
              '${hashedPassword}', 
              '${gender}',
              '${location}'
            )`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    response.send(`Created new user with ${newUserId}`);
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// Login User API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    // bcrypt.compare() function compares the password entered by the user and hash against each other
    if (isPasswordMatched === true) {
      const payload = {username : username};
      const jwtToken = jwt.sign(payload, "abcdefgh"); //(payload,"MY_SECRET_TOKEN")
      response.send({jwtToken});
      //response.send("Login Success!");
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

/*Status Codes	Status Text ID
200	OK
204	No Response
301	Moved Permanently
400	Bad Request
403	Forbidden
401	Unauthorized
*/

// Change Password API
app.put("/change-password", async (request, response) => {
  const { username, oldPassword, newPassword } = request.body;
  const checkForUserQuery = `
      select * from user where username = '${username}'`;
  const dbUser = await db.get(checkForUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("User not registered");
  } else {
    const isValidPassword = await bcrypt.compare(oldPassword, dbUser.password);
    if (isValidPassword === true) {
      const lengthOfNewPassword = newPassword.length;
      if (lengthOfNewPassword < 5) {
        response.status(400);
        response.send("Password is too short");
      } else {
        const encryptedPassword = await bcrypt.hash(newPassword, 10);
        const updatePasswordQuery = `
            update user 
            set password = '${encryptedPassword}' 
            where username = '${username}'`;
        await db.run(updatePasswordQuery);
        response.send("Password updated");
      }
    } else {
      response.status(400);
      response.send("Invalid current password");
    }
  }
});

// Authentication Mechanisms 
// Commonly used authentication mechanisms: Token Authentication , Session Authentication
// Token Authentication - Access Token is a set of characters which are used to identify a user. It is used to verify whether a user is Valid/Invalid
// How it works? -> Server generates token and certifies client. Client uses this token on every subsequent request.. Client doesn't need to provide full details every time.
// JWT - JSON Web Token (is a standard used to create access tokens for an application) (for installation: npm install jsonwebtoken --save)
// JWT provides methods to generate and verify JWT token: jwt.sign(), jwt.verify()
/* jwt.sign() function takes payload and secret key as arguments to generate jwtToken out of it
syntax: const jwtToken = jwt.sign(payload, secretKey, callBack)

jwt.verify() verifies jwtToken and if it's valid, returns payload, Else, it throws an error
syntax: const payload = jwt.verify(jwtToken, secretKey, callBack)
*/

/* Passing JWT Token in URL is not preferable,we can't pass JWT token using path and query parameters because URL is public it can be copied and misused.
We also can't pass using request body because methods like GET won't have request body and every time we make a API call we need to send it in request body.*/

// We pass JWT TOken using HTTP Headers, We have to add authorization header to our request and JWT TOken is passed as Bearer token.
app.get("/books/", (request, response) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid Access Token");
    } else {
      jwt.verify(jwtToken, "abcdefgh", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid Access Token");
        } else {
          const getBooksQuery = `
              SELECT
                *
              FROM
               book
              ORDER BY
                book_id;`;
          const booksArray = await db.all(getBooksQuery);
          response.send(booksArray);
        }
      });
    }
  });