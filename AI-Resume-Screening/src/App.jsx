function App() {

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];

    const formData = new FormData();
    formData.append("resume", file);

    await fetch(
      "http://localhost:5678/webhook-test/resume_upload",
      {
        method: "POST",
        body: formData,
      }
    );

    alert("Resume Uploaded Successfully");
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">

      <div className="bg-white p-8 rounded-xl shadow-md">

        <h1 className="text-2xl font-bold mb-5 text-center">
          Resume Upload
        </h1>

        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileUpload}
          className="border p-2 rounded w-full"
        />

      </div>

    </div>
  );
}

export default App;