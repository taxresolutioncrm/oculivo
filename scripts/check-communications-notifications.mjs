import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const bell=readFileSync('src/components/CommunicationsBell.tsx','utf8')
const app=readFileSync('src/App.tsx','utf8')
for(const term of [
 ".eq('organization_id',organizationId)",".eq('direction','inbound')",".eq('is_read',false)",
 "count:'exact',head:true", "communication_threads!inner(channel)",
 "env(safe-area-inset-bottom,0px)","min-width:44px","aria-modal=\"false\"",
 "e.key==='Escape'","setOpen(false);setCounts(null);setUnread(null);setError('')",
])assert(bell.includes(term),'Oculivo practice notification contract missing '+term)
assert(app.includes('<CommunicationsBell key={selectedOrg?.id||'), 'Single existing bell must be replaced without creating a second')
assert(!app.includes('<Bell size={17}/>'),'Duplicate old bell should be removed')
assert(!bell.includes('service_role')&&!bell.includes('new Notification('),'No browser secret or unverified push')
console.log('PASS Oculivo tenant-scoped unread messaging, mobile and accessibility guard')
