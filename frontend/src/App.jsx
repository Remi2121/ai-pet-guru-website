import React from 'react';

const App = () => {
  return (
    <div className="flex justify-center items-center h-screen flex-col">
      <h1 className="text-4xl font-bold my-5">
        Hello Welcome to my Ai pet shop
      </h1>

      <button className="bg-transparent hover:bg-blue-500 text-blue-700 font-semibold hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded">
        Start pet care journey
      </button>
    </div>
  );
};

export default App;
