import { supabase } from './supabase'
import { useCallback, useRef, useState } from 'react'

const FALLBACK_ICE: RTCConfiguration={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]}
const MAX_PARTICIPANTS=6

export function useTeamHuddle(prefix:string){
  const [members,setMembers]=useState<string[]>([])
  const [remoteStreams,setRemoteStreams]=useState<Record<string,MediaStream>>({})
  const [remoteScreenStreams,setRemoteScreenStreams]=useState<Record<string,MediaStream>>({})
  const [localStream,setLocalStream]=useState<MediaStream|null>(null)
  const [micOn,setMicOn]=useState(true)
  const [cameraOn,setCameraOn]=useState(true)
  const [joined,setJoined]=useState(false)
  const [sharingScreen,setSharingScreen]=useState(false)
  const [error,setError]=useState('')
  const localRef=useRef<MediaStream|null>(null)
  const screenRef=useRef<MediaStreamTrack|null>(null)
  const peers=useRef<Record<string,RTCPeerConnection>>({})
  const channelRef=useRef<any>(null)
  const myName=useRef('')
  const iceRef=useRef<RTCConfiguration>(FALLBACK_ICE)
  const fullyJoined=useRef(false)

  const closePeer=(name:string)=>{
    peers.current[name]?.close(); delete peers.current[name]
    setRemoteStreams(p=>{const n={...p};delete n[name];return n})
    setRemoteScreenStreams(p=>{const n={...p};delete n[name];return n})
  }

  const createPC=(peer:string)=>{
    closePeer(peer)
    const pc=new RTCPeerConnection(iceRef.current); peers.current[peer]=pc
    localRef.current?.getTracks().forEach(t=>pc.addTrack(t,localRef.current!))
    if(screenRef.current) pc.addTrack(screenRef.current,new MediaStream([screenRef.current]))
    pc.ontrack=(e)=>{
      const t=e.track
      if(t.kind==='audio') return
      const isScreen=t.contentHint==='detail'||/screen|window|tab/i.test(t.label||'')||Boolean(remoteStreams[peer])
      const s=e.streams[0]||new MediaStream([t])
      if(isScreen)setRemoteScreenStreams(p=>({...p,[peer]:s}))
      else setRemoteStreams(p=>({...p,[peer]:s}))
    }
    pc.onicecandidate=e=>{if(e.candidate)channelRef.current?.send({type:'broadcast',event:'signal',payload:{from:myName.current,to:peer,type:'ice',candidate:e.candidate}})}
    return pc
  }

  const offer=async(peer:string)=>{
    const pc=createPC(peer),o=await pc.createOffer();await pc.setLocalDescription(o)
    await channelRef.current?.send({type:'broadcast',event:'signal',payload:{from:myName.current,to:peer,type:'offer',sdp:o.sdp}})
  }

  const signal=async(p:any)=>{
    if(p?.to!==myName.current)return
    if(p.type==='offer'){
      const pc=createPC(p.from);await pc.setRemoteDescription({type:'offer',sdp:p.sdp})
      const a=await pc.createAnswer();await pc.setLocalDescription(a)
      await channelRef.current?.send({type:'broadcast',event:'signal',payload:{from:myName.current,to:p.from,type:'answer',sdp:a.sdp}})
    }else if(p.type==='answer'){const pc=peers.current[p.from];if(pc)await pc.setRemoteDescription({type:'answer',sdp:p.sdp})}
    else if(p.type==='ice'){const pc=peers.current[p.from];if(pc&&p.candidate)await pc.addIceCandidate(p.candidate)}
  }

  const join=useCallback(async(roomId:string,name:string)=>{
    setError('');myName.current=name
    const icePromise=supabase.functions.invoke('turn-credentials').then(({data,error})=>{
      if(!error&&Array.isArray(data)&&data.length)iceRef.current={iceServers:data}
    }).catch(()=>{})
    const ch=supabase.channel(`${prefix}:${roomId}`,{config:{broadcast:{self:false},presence:{key:name}}});channelRef.current=ch
    ch.on('broadcast',{event:'signal'},({payload}:any)=>void signal(payload))
    ch.on('presence',{event:'sync'},()=>setMembers(Object.keys(ch.presenceState())))
    ch.on('presence',{event:'join'},({key}:any)=>{setMembers(m=>m.includes(key)?m:[...m,key]);if(key!==name&&fullyJoined.current)void offer(key)})
    ch.on('presence',{event:'leave'},({key}:any)=>{setMembers(m=>m.filter(x=>x!==key));closePeer(key)})
    await new Promise<void>(r=>ch.subscribe((s:string)=>{if(s==='SUBSCRIBED')r()}))
    if(Object.keys(ch.presenceState()).length>=MAX_PARTICIPANTS){await supabase.removeChannel(ch);setError('This huddle is full (6 people max).');return false}
    let stream:MediaStream
    try{stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true})}
    catch{
      try{stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});setCameraOn(false);setError('Camera unavailable — joined audio only.')}
      catch{await supabase.removeChannel(ch);setError('Microphone access denied.');return false}
    }
    localRef.current=stream;setLocalStream(stream);await icePromise
    await ch.track({name,activity:'huddle',room_id:roomId})
    fullyJoined.current=true;setJoined(true);setMembers(m=>m.includes(name)?m:[...m,name]);return true
  },[prefix])

  const leave=useCallback(async()=>{
    fullyJoined.current=false
    screenRef.current?.stop();screenRef.current=null;setSharingScreen(false)
    if(channelRef.current){await channelRef.current.untrack().catch(()=>{});await supabase.removeChannel(channelRef.current);channelRef.current=null}
    Object.keys(peers.current).forEach(closePeer)
    localRef.current?.getTracks().forEach(t=>t.stop());localRef.current=null
    setLocalStream(null);setMembers([]);setRemoteStreams({});setRemoteScreenStreams({});setJoined(false)
  },[])

  const toggleMic=()=>{const t=localRef.current?.getAudioTracks()[0];if(t){t.enabled=!t.enabled;setMicOn(t.enabled)}}
  const toggleCamera=()=>{const t=localRef.current?.getVideoTracks()[0];if(t){t.enabled=!t.enabled;setCameraOn(t.enabled)}}
  const startScreenShare=async()=>{
    try{
      const s=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false}),t=s.getVideoTracks()[0]
      t.contentHint='detail';screenRef.current=t;setSharingScreen(true)
      for(const pc of Object.values(peers.current))pc.addTrack(t,s)
      t.onended=()=>{screenRef.current=null;setSharingScreen(false);setRemoteScreenStreams(p=>p)}
    }catch{setError('Screen sharing was cancelled or blocked.')}
  }
  const stopScreenShare=()=>{screenRef.current?.stop();screenRef.current=null;setSharingScreen(false)}
  return{members,remoteStreams,remoteScreenStreams,localStream,micOn,cameraOn,joined,sharingScreen,error,join,leave,toggleMic,toggleCamera,startScreenShare,stopScreenShare}
}
