import React, { useRef, useEffect, useState } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import '@fortawesome/fontawesome-free/css/all.min.css';


const firebaseConfig = {
  apiKey: "AIzaSyCjqfWEFnsPdQq950mvfSBkFlexahwf9KU",
  authDomain: "video-chat-demo-app.firebaseapp.com",
  projectId: "video-chat-demo-app",
  storageBucket: "video-chat-demo-app.appspot.com",
  messagingSenderId: "479963895628",
  appId: "1:479963895628:web:8e1c3258dd99096c7da1e9",
  measurementId: "G-TFD8R33SMS",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();

const VideoChatComponent = () => {
  const pc = useRef(null);
  const webcamVideo = useRef(null);
  const remoteVideo = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callId, setCallId] = useState('');
  const [isWebcamButtonDisabled, setIsWebcamButtonDisabled] = useState(false);
  const [isCallButtonDisabled, setIsCallButtonDisabled] = useState(true);
  const [isAnswerButtonDisabled, setIsAnswerButtonDisabled] = useState(true);
  const [isHangupButtonDisabled, setIsHangupButtonDisabled] = useState(true);


  // Peer Connection
  // free stun servers by google
  useEffect(() => {
    pc.current = new RTCPeerConnection({
      iceServers: [
        {
          urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
        },
      ],
      iceCandidatePoolSize: 10,
    });
  }, []);

  const handleWebcamButtonClick = async () => {
    setIsWebcamButtonDisabled(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      webcamVideo.current.srcObject = stream;

      stream.getTracks().forEach((track) => {
        pc.current.addTrack(track, stream);
      });

      pc.current.ontrack = (event) => {
        const remoteStream = event.streams[0];
        setRemoteStream(remoteStream);
        remoteVideo.current.srcObject = remoteStream;
      };

      setIsCallButtonDisabled(false);
      setIsAnswerButtonDisabled(false);
    } catch (error) {
      console.error('Error accessing webcam:', error);
      setIsWebcamButtonDisabled(false);
    }
  };

  const handleCallButtonClick = async () => {
    const callDoc = firestore.collection("calls").doc();
    const offerCandidates = callDoc.collection("offerCandidates");
    const answerCandidates = callDoc.collection("answerCandidates");

    setCallId(callDoc.id);

    pc.current.onicecandidate = (event) => {
      event.candidate && offerCandidates.add(event.candidate.toJSON());
    };

    const offerDescription = await pc.current.createOffer();
    await pc.current.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await callDoc.set({ offer });

    callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (!pc.current.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.current.setRemoteDescription(answerDescription);
      }
    });

    answerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.current.addIceCandidate(candidate);
        }
      });
    });

    setIsHangupButtonDisabled(false);
    navigator.clipboard.writeText(callDoc.id);

    // Display popup
    const popup = document.createElement("div");
    popup.className = "popup";
    popup.textContent = "Meet credentials copied to clipboard";
    document.body.appendChild(popup);
    setTimeout(() => {
      popup.remove();
    }, 2000);
  };

  const handleAnswerButtonClick = async () => {
    const callDoc = firestore.collection("calls").doc(callId);
    const answerCandidates = callDoc.collection("answerCandidates");
    const offerCandidates = callDoc.collection("offerCandidates");

    pc.current.onicecandidate = (event) => {
      event.candidate && answerCandidates.add(event.candidate.toJSON());
    };

    const callData = (await callDoc.get()).data();

    const offerDescription = callData.offer;
    await pc.current.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await callDoc.update({ answer });

    offerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.current.addIceCandidate(candidate);
        }
      });
    });
  };

  const handleHangupButtonClick = () => {
    pc.current.close();
    localStream.getTracks().forEach((track) => {
      track.stop();
    });
    remoteStream.getTracks().forEach((track) => {
      track.stop();
    });

    webcamVideo.current.srcObject = null;
    remoteVideo.current.srcObject = null;

    setIsWebcamButtonDisabled(false);
    setIsCallButtonDisabled(true);
    setIsAnswerButtonDisabled(true);
    setIsHangupButtonDisabled(true);

    setCallId('');
  };

  return (
    <div>
      <h2>Start your Webcam</h2>
      <div className="videos">
        <span>
          <h3>User 1</h3>
          {/* local stream */}
          <video ref={webcamVideo} autoPlay playsInline></video>
        </span>
        <span>
          <h3>User 2</h3>
          {/* remote stream */}
          <video ref={remoteVideo} autoPlay playsInline></video>
        </span>
      </div>

      <button id="webcamButton" onClick={handleWebcamButtonClick} disabled={isWebcamButtonDisabled}>
        Start webcam
      </button>

      <h2>Create a new Call</h2>
      <button id="callButton" onClick={handleCallButtonClick} disabled={isCallButtonDisabled}>
        Create Call
      </button>

      <h2>Join a Call</h2>
      <p>Answer the call from a different browser window or device</p>

      <input id="callInput" value={callId} onChange={(e) => setCallId(e.target.value)} />
      <button id="answerButton" onClick={handleAnswerButtonClick} disabled={isAnswerButtonDisabled}>
        {/* Answer */}
        <i className="fas fa-phone"></i>
      </button>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          id="hangupButton"
          onClick={handleHangupButtonClick}
          disabled={isHangupButtonDisabled}
          className="hangup-button"
        >
          <i className="fas fa-phone"></i>
        </button>
      </div>
    </div>
  );
};

export default VideoChatComponent;
