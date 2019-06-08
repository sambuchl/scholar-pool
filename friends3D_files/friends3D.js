
// search?
// draggable?

var friends;
var fLinks;

var statusDiv;
var dataDiv;
var canvas;
var canvasDiv;
var infoDiv;
var controlsDiv;
var aboutDiv;

var pjs;

var pending; //for counting queries

var aboutShown=false;

function showAbout(){
	if(aboutShown){
		 hideAbout();
	}else{
		aboutDiv.style.visibility='visible';
		aboutShown=true;
	}
}
function hideAbout(){
	if(aboutShown){
		aboutDiv.style.visibility='hidden';
		aboutShown=false;
	}
}


function init(){

	setTimeout(giveUp,10000);

	statusDiv=document.getElementById('status');
	dataDiv=document.getElementById('data');
	canvas = document.getElementById("mainCanvas");
	canvasDiv = document.getElementById("canvasBox");
	infoDiv = document.getElementById("info");
	controlsDiv = document.getElementById("controls");
	aboutDiv = document.getElementById("about");

	window.addEventListener('DOMMouseScroll', mouseWheel, true);
	document.onmousewheel = mouseWheel;


	pjs=new Processing(canvas, pSketch);

	window.onresize=doResize;

	document.onkeydown=keyPressed;
	document.onkeyup=keyReleased;
	window.onblur=windowBlur;


	window.fbAsyncInit = function() {
	  FB.init({
	    appId      : '151202688284345', // App ID
	    channelURL : '//www.sccs.swarthmore.edu/users/12/abiele1/friends3D/channel.php', // Channel File
	    status     : true, // check login status
	    cookie     : true, // enable cookies to allow the server to access the session
	    oauth      : true, // enable OAuth 2.0
	    xfbml      : true  // parse XFBML
	  });


		FB.Event.subscribe('auth.authResponseChange', function(response) {
			checkLogin()
		});

		checkLogin();

	  // Additional initialization code here
	};

	// Load the SDK Asynchronously
	(function(d){
	  var js, id = 'facebook-jssdk'; if (d.getElementById(id)) {return;}
	  js = d.createElement('script'); js.id = id; js.async = true;
	  js.src = "//connect.facebook.net/en_US/all.js";
	  //js.src = "//connect.facebook.net/fr_FR/all.js";
	  d.getElementsByTagName('head')[0].appendChild(js);
	}(document));
}

// cop-out
// it'd be better if we tried to figure out why/if it's not working.
function giveUp(){
	if(statusDiv.innerHTML=='one sec.'){
		statusDiv.innerHTML="k, so this doesn't seem to be working.<br>"
		 +"You can try reloading, but your browser/OS/GPU may not be supported at this time.<br>"
		 +"It's probably an issue with <a href='http://get.webgl.org/'>webGL</a>.<br>"
		 +"Sorry!";
	}

}

function checkLogin(){
	FB.getLoginStatus(function(response) {
		if (response.authResponse) {
			// logged in and connected user, someone you know

			statusDiv.innerHTML='logged in...';

			FB.api('/me', function(response) {
				statusDiv.innerHTML=response.name+' (<a href="#" onclick="FB.logout();return false;">logout</a>)';
				dataDiv.innerHTML='<a href="#" onclick="go();return false;" title="(space)">go!</a>';
				go();
			});

		} else {
			// no user session available, someone you dont know
			statusDiv.innerHTML='<a href="#" onclick="FB.login();return false;">login</a>';
		}
	});
}

function doQuery(query,cb){
	FB.api(
		{
			method: 'fql.query',
			query: query
		},
			function(response) {
			cb(response)
		}
	);
}

function go(){

	dataDiv.innerHTML='...';

	var queryNames="SELECT uid,name,sex,affiliations from user where uid in (select uid2 from friend where uid1=me())";


	doQuery(queryNames,function(response){
		dataDiv.innerHTML=response.length+" friends...";
		friends=response;

		//this is the part where we do it in chunks

		var chunkSize=75; //usually sufficient. could be too big for someone with many tightly linked friends.
		var numChunks=Math.ceil(friends.length/chunkSize);

		fLinks=[];

		pending=numChunks;

		for(var i=0;i<numChunks;i++){

			var linkQuery="SELECT uid1, uid2 FROM friend WHERE "+
"uid1 IN (SELECT uid2 FROM friend WHERE uid1 = me() LIMIT "+chunkSize+" OFFSET "+i*chunkSize+") AND "+
"uid2 IN (SELECT uid2 FROM friend WHERE uid1 = me())";

			doQuery(linkQuery,function(response){
				fLinks=fLinks.concat(response);
				if(console)
					console.log('chunk: '+response.length);
				pending--;
				if(!pending){
					create();
				}
			});

		}

	});
}



////// Processing.js code //////

function pSketch(p){
	p.draw = draw;
	p.setup = setup;
	p.mouseDragged=mouseDragged;
	p.mouseMoved=mouseMoved;
	p.mousePressed=mousePressed;
	p.mouseReleased=mouseReleased;
}

var pushMax=300;

var dst=1000;
var theta=Math.PI/5;
var phi=Math.PI/6;

var dTheta=0;
var dPhi=0;

var pullF=.00004;
var pushF=2500;

var nodes=[];
var links=[];

var drawLinks=false;
var drawNodes=true;
var drawHover=true;

var doStuff=true;

var hover;

var colorMode='l';

var maxLinks=0;

var curKey=0;

var totalMovement=0;

var done=false;

var mouseIsPressed=false;

function setup(){
	//this.size(700,500,this.P3D);
	doResize(this);
	this.lights();
	this.noLoop();
	this.background(0,0);
}

function create(){

	var nodeMap={};

	for(var i in friends){
		nodeMap[friends[i].uid]=new Node(friends[i]);
	}

	for(var i in fLinks){
		if(nodeMap[fLinks[i].uid1] && nodeMap[fLinks[i].uid2]){
			//remove duplicates
			var unique=true;
			for(var j=i-1;j+1;j--){

				//this part is taking too long! firefox complains.
				if(fLinks[j].uid2==fLinks[i].uid1 && fLinks[j].uid1==fLinks[i].uid2)
					unique=false;

			}
			if(unique)
				links.push(new Link(nodeMap[fLinks[i].uid1],nodeMap[fLinks[i].uid2]));
		}
	}

	dataDiv.innerHTML=friends.length+" friends, "+links.length+" links.";


	for(var i in nodeMap){
		nodes.push(nodeMap[i]);
	}

	for(var i in nodes){
		var node=nodes[i];

		node.countLinks();
		if(node.linkCount>maxLinks)
			maxLinks=node.linkCount;

		node.makeInfo();
	}

	colorizeNodes();

	makeControls();

	pjs.loop();
}

function makeControls(){
	controlsDiv.innerHTML='Color by <select id="cMode" onchange="readControls(event)" title="color mode (c)">'+
	'<option value="l"'+(colorMode=="l"?"selected":"")+'>links</option>'+
	'<option value="s"'+(colorMode=="s"?"selected":"")+'> sex</option></select>. '+
	'Draw: <a href="#" id="drawNodes" onclick="readControls(event);return false;" title="'+(drawNodes?"hide nodes":"show nodes")+' (n)">'+(drawNodes?"nodes":"no nodes")+'</a>, '+
	'<a href="#" id="drawLinks" onclick="readControls(event);return false;" title="'+(drawLinks?"hide links":"show links")+' (l)">'+(drawLinks?"links":"no links")+'</a>. '+
	'<a href="#" id="run" onclick="readControls(event);return false;" title="'+(doStuff?"Pause":"Run")+' (space)">'+(doStuff?"Running":"Paused")+'</a>.';
}
function readControls(e){
	switch(e.target.id){
		case 'cMode':
			colorMode=e.target.value;
			colorizeNodes();
			drawOnce()
			break;
		case 'run':
			runToggle();
			break;
		case 'drawNodes':
			drawNodes=!drawNodes;
			drawOnce()
			break;
		case 'drawLinks':
			drawLinks=!drawLinks;
			drawOnce()
			break;
	}

	makeControls();
}

function drawOnce(){
	if(!doStuff){
	//	drawingOnce=true;
		pjs.redraw();
	}
}

function draw(){

	if(!pjs)return;

	keyPan(); //this doesn't work when paused. we may want to re-think how pausing works.
	// actually, it does. the repeated keyPress event forces redraw...

	if(!mouseIsPressed){
		applyPan();
	}

	if(doStuff) doPhysics();

	doDraw();

	//drawingOnce=false;


	if(Math.abs(dTheta)+Math.abs(dPhi)>.001){
		if(!doStuff)pjs.loop();
		//drawingOnce=true;
	}else{
		if(!doStuff)pjs.noLoop();
		dTheta=0;
		dPhi=0;
	}
}

function doPhysics(){
	for(var i in links) links[i].pull();
	for(var i in nodes) nodes[i].push();

	totalMovement=0;
	for(var i in nodes) nodes[i].apply();

	//stop running once nodes settle
	if(!done && totalMovement/nodes.length<.08){
		done=true;
		runToggle();
	}
}

function doDraw(){

	pjs.background(0,0);

	pjs.camera(dst*Math.cos(theta)*Math.cos(phi),
	           dst*Math.sin(theta)*Math.cos(phi),
	                          -dst*Math.sin(phi), 0, 0, 0, 0, 0, 1);

	pjs.directionalLight(130, 130, 130, -1, -2, 3);
	pjs.directionalLight(100, 100, 100, 2, 0, 3);
	pjs.ambientLight(150, 150, 150);

	//figure out if we're hovering
	if (drawHover) {

		var minDist=20;

		var newHover;

		for(var i in nodes){
			//stroke(0);

			var n=nodes[i];

			var nx=pjs.screenX(n.x, n.y, -n.z);
			var ny=pjs.screenY(n.x, n.y, -n.z);

			var mDist=pjs.dist(pjs.mouseX, pjs.mouseY, nx, ny);

			if(mDist<minDist){
				minDist=mDist;
				newHover=n;
			}
		}
		if(minDist==20){
			newHover=null;
		}

		if(newHover!=hover){
			hover=newHover;
			upInfo();
		}
	}

	if(drawNodes)
		for(var i in nodes)
			nodes[i].draw();

	for(var i in links){
		var lnk=links[i];
		if(drawLinks || lnk.n1==hover || lnk.n2==hover)
			lnk.draw();
	}
}


function keyPressed(e){

	curKey=e.which;

	//console.log(pjs.key);
	switch(e.which) {
		case 189: //'-':
		case 109: //'-':ff
			dst*=1.2;
			break;
		case 187: //'=':
		case 61: //'=':ff
			dst/=1.2;
			break;
		case 32: // space
			if(nodes.length){
				runToggle();
			}else{
				go();
			}
			break;
		case 76: // l
			drawLinks=!drawLinks;
			makeControls();
			break;
		case 78: // n
			drawNodes=!drawNodes;
			makeControls();
			break;
		case 67: // c
			if(colorMode=='s'){
				colorMode='l';
			}else{
				colorMode='s';
			}
			colorizeNodes();
			makeControls();
			break;
	}

	drawOnce();
}

function runToggle(){
	doStuff=!doStuff;
	if(doStuff){
		pjs.loop();
	}else{
		pjs.noLoop();
	}

	makeControls();
}

function keyReleased(e){
	curKey=0;
}

function windowBlur(){
	curKey=0;
	//console.log('blur!');
}

// pan using arrow keys (beta)
function keyPan(){

	var panSpeed=Math.PI/120;

	switch(curKey){
		case 38:dPhi=-panSpeed;break; //up
		case 40:dPhi=panSpeed;break; //down
		case 39:dTheta=-panSpeed;break; //right
		case 37:dTheta=panSpeed;break; //left
		default:
			return;
	}

	applyPan();
}

function colorizeNodes(){
	for(var i in nodes){
		nodes[i].colorize();
	}
}

function mouseMoved(){
	drawOnce();
}
function mousePressed(){
	mouseIsPressed=true;
	hideAbout();
}
function mouseReleased(){
	mouseIsPressed=false;
}

function mouseDragged() {

	///move camera///
	dTheta=-this.TWO_PI*((this.mouseX-this.pmouseX)/this.width);
	dPhi=this.PI*((this.mouseY-this.pmouseY)/this.height);

	applyPan();

	drawOnce();

}

function applyPan(){

	theta+=dTheta;
	phi+=dPhi;

	//limit phi
	if (phi>=pjs.HALF_PI) phi=pjs.HALF_PI-.00001;
	if (phi<=-pjs.HALF_PI)phi=-pjs.HALF_PI+.00001;

	dTheta*=.85;
	dPhi*=.85;
}

//http://www.switchonthecode.com/tutorials/javascript-tutorial-the-scroll-wheel
function mouseWheel(e)
{
  e = e ? e : window.event;
  var wheelData = e.detail ? e.detail * .02 : e.wheelDelta * -.0025;
  //do something
  dst*=Math.exp(wheelData);

  if(dst<1)dst=1;
  if(dst>5000)dst=5000;

	drawOnce();
}

function upInfo(){

	//var newInfo="";

	infoDiv.innerHTML="";

	if(hover){
		infoDiv.appendChild(hover.infoDiv);
	}
}

function doResize(that){
	var p=pjs||that;

	if(p && canvas){
		try{
			p.size(canvasDiv.clientWidth,canvasDiv.clientHeight,p.P3D);
		}catch(err){

		}
	}
}

//function Node(x,y,z,name,uid,sex){
function Node(fObj){

	this.x=rand(-50,50);
	this.y=rand(-50,50);
	this.z=rand(-50,50);
	this.name=fObj.name;
	this.uid=fObj.uid;
	this.sex=fObj.sex;

	this.color=0;

	this.dvx=0;
	this.dvy=0;
	this.dvz=0;

	this.linkCount=0;
	this.infoDiv;


	this.colorize=function(){
		switch(colorMode){
			case 's': //sex
				this.color=pjs.color(255,85,255);

				if(this.sex){
					switch(this.sex[0]){
						case 'm': this.color=pjs.color(85,85,255);break;
						case 'f': this.color=pjs.color(255,85,85);break;
					}
				}
				break;

			case 'l':

				var hMax=180

				var nLink=this.linkCount/maxLinks*(hMax/360);

				pjs.colorMode(pjs.HSB);
				this.color=pjs.color(hMax-nLink*360,200,250);
				pjs.colorMode(pjs.RGB);

				break;

		}
	}


	this.draw=function(){
		pjs.pushMatrix();
      	pjs.translate(this.x, this.y, -this.z);
      	pjs.fill(this.color);

      	if(this==hover){
      		pjs.fill(255);
      	}

      	pjs.noStroke();
        pjs.box(12);
		pjs.popMatrix();
	}

	this.makeInfo=function(){

		var img=new Image();
		img.src='http://graph.facebook.com/'+this.uid+'/picture';

		this.infoDiv=document.createElement('div');

		var badge=document.createElement('div');
		    badge.innerHTML=this.name+(fObj.affiliations.length?("<br>"+fObj.affiliations[0].name):"")+"<br>"+this.linkCount;

		this.infoDiv.appendChild(img);
		this.infoDiv.appendChild(badge);
	}

	//this part is O(n^2)
	//it uses lots of cpu. can it be made more efficient?
	this.push=function(){

		//for(var i in nodes) {
		var i=nodes.length;
		while(i--){
			var n=nodes[i];
			if (n!=this) {

				var dx=n.x-this.x;
				var dy=n.y-this.y;
				var dz=n.z-this.z;

				var dst=dist3(dx,dy,dz);

				dx/=dst;
				dy/=dst;
				dz/=dst;

				//stop pushing if it's too far
				if (dst<pushMax) {

					if (dst<30) dst=30; //for safety

					var f=pushF/(dst*dst);

					this.dvx-=dx*f;
					this.dvy-=dy*f;
					this.dvz-=dz*f;
				}
			}
		}
	}

	this.apply=function(){

		//limit deltas here!

		var mag=dist3(this.dvx,this.dvy,this.dvz);

		var dmax=30;

		//to avoid oscillation
		if(mag>dmax){
			this.dvx*=dmax/mag;
			this.dvy*=dmax/mag;
			this.dvz*=dmax/mag;
			mag=dmax;
		}
		if(!done)totalMovement+=mag;

		this.x+=this.dvx;
		this.y+=this.dvy;
		this.z+=this.dvz;

		this.dvx=0;
		this.dvy=0;
		this.dvz=0;
	}


	this.countLinks=function(){

		var count=0;

		for(var i in links){
			var link=links[i];

			if(link.n1==this || link.n2==this){
				count++;
			}
		}

		this.linkCount=count;
	}
}

function Link(n1,n2){
	this.n1=n1;
	this.n2=n2;

	this.draw=function(){
		pjs.strokeWeight(.5);
		pjs.stroke(80,80);
		if(this.n1==hover || this.n2==hover)
			pjs.stroke(200,80);

		pjs.line(n1.x,n1.y,-n1.z,n2.x,n2.y,-n2.z);
	}

	this.pull=function(){
		var dx=this.n2.x-this.n1.x;
		var dy=this.n2.y-this.n1.y;
		var dz=this.n2.z-this.n1.z;

		var dst=dist3(dx,dy,dz);

		if(dst<1)dst=1;

		dx/=dst;
		dy/=dst;
		dz/=dst;

		if(dst>500)dst=500;//otherwise, boom!

		var f=pullF*dst*dst;

		this.n1.dvx+=dx*f;
		this.n1.dvy+=dy*f;
		this.n1.dvz+=dz*f;

		this.n2.dvx-=dx*f;
		this.n2.dvy-=dy*f;
		this.n2.dvz-=dz*f;
	}
}

function dist3(x,y,z){
	return Math.sqrt(x*x+y*y+z*z);
}
function rand(min,max){
	return Math.random()*(max-min)+min;
}
