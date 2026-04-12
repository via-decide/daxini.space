const c=document.getElementById('bg'),x=c.getContext('2d');let pts=[];
function sz(){c.width=innerWidth;c.height=innerHeight}addEventListener('resize',sz);sz();
class Pt{constructor(){this.x=Math.random()*c.width;this.y=Math.random()*c.height;this.r=Math.random()*2+.5;this.dx=(Math.random()-.5)*.4;this.dy=(Math.random()-.5)*.4}
update(){this.x+=this.dx;this.y+=this.dy;if(this.x<0||this.x>c.width)this.dx*=-1;if(this.y<0||this.y>c.height)this.dy*=-1}
draw(){x.fillStyle='#1565C030';x.beginPath();x.arc(this.x,this.y,this.r,0,6.28);x.fill()}}
for(let i=0;i<80;i++)pts.push(new Pt);
(function loop(){x.clearRect(0,0,c.width,c.height);pts.forEach(p=>{p.update();p.draw()});requestAnimationFrame(loop)})();