// Lightweight lexical coloring, not an AST parser. React escapes every token.
const extensions=/\.(?:[cm]?[jt]sx?|rs|py|json|css|html|xml|sh|ps1|ya?ml|toml|md)$/i;
export default function SyntaxText({text,file}:{text:string;file:string}){
 if(!extensions.test(file)||text.length>20000)return <>{text}</>;
 const tokens=text.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*$|#[^\n]*$|\b(?:const|let|var|function|return|export|import|from|if|else|true|false|null|fn|pub|use|struct|impl|def|class|async|await)\b|\b\d+(?:\.\d+)?\b)/g);
 return <>{tokens.map((t,i)=><span key={i} className={/^['"]/.test(t)?'syntax-string':/^(\/\/|#)/.test(t)?'syntax-comment':/^\d/.test(t)?'syntax-number':/^(const|let|var|function|return|export|import|from|if|else|true|false|null|fn|pub|use|struct|impl|def|class|async|await)$/.test(t)?'syntax-keyword':undefined}>{t}</span>)}</>;
}
