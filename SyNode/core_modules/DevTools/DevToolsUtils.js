"use strict";
let {logError} = process.binding('debugger');

/**
 * Turn the error |aError| into a string, without fail.
 */
function safeErrorString(aError) {
    try {
        let errorString = aError.toString();
        if (typeof errorString == "string") {
            // Attempt to attach a stack to |errorString|. If it throws an error, or
            // isn't a string, don't use it.
            try {
                if (aError.stack) {
                    let stack = aError.stack.toString();
                    if (typeof stack == "string") {
                        errorString += "\nStack: " + stack;
                    }
                }
            } catch (ee) { }

            // Append additional line and column number information to the output,
            // since it might not be part of the stringified error.
            if (typeof aError.lineNumber == "number" && typeof aError.columnNumber == "number") {
                errorString += "Line: " + aError.lineNumber + ", column: " + aError.columnNumber;
            }

            return errorString;
        }
    } catch (ee) { }

    // We failed to find a good error description, so do the next best thing.
    return Object.prototype.toString.call(aError);
};

/**
 * Report that |aWho| threw an exception, |aException|.
 */
export function reportException(aWho, aException) {
    let msg = aWho + " threw an exception: " + safeErrorString(aException);
    logError(msg);
};

/**
 * Safely get the property value from a Debugger.Object for a given key. Walks
 * the prototype chain until the property is found.
 *
 * @param Debugger.Object aObject
 *        The Debugger.Object to get the value from.
 * @param String aKey
 *        The key to look for.
 * @return Any
 */
export function getProperty(aObj, aKey) {
    let root = aObj;
    try {
        do {
            const desc = aObj.getOwnPropertyDescriptor(aKey);
            if (desc) {
                if ("value" in desc) {
                    return desc.value;
                }
                // Call the getter if it's safe.
                return hasSafeGetter(desc) ? desc.get.call(root).return : undefined;
            }
            aObj = aObj.proto;
        } while (aObj);
    } catch (e) {
        // If anything goes wrong report the error and return undefined.
        //exports.reportException("getProperty", e);
    }
    return undefined;
};

/**
 * Determines if a descriptor has a getter which doesn't call into JavaScript.
 *
 * @param Object aDesc
 *        The descriptor to check for a safe getter.
 * @return Boolean
 *         Whether a safe getter was found.
 */
export function hasSafeGetter(aDesc) {
    // Scripted functions that are CCWs will not appear scripted until after
    // unwrapping.
    try {
        let fn = aDesc.get.unwrap();
        return fn && fn.callable && fn.class == "Function" && fn.script === undefined;
    } catch(e) {
        // Avoid exception 'Object in compartment marked as invisible to Debugger'
        return false;
    }
};

